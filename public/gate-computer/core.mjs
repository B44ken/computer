// All CPU cells are scalar primitives. Groups/bit/column are drawing annotations only.
export const ALLOWED = new Set(['AND','NAND','OR','NOR','XOR','XNOR','MUX','NOT','DFF']);
const bits = (name, n) => Array.from({length:n}, (_,i)=>`${name}[${i}]`);
export function buildCPU(variant='manual') {
  const cells=[];
  const add=(type,id,inputs,group,bit=0,col=0)=>{
    if(!ALLOWED.has(type)) throw Error(`non-primitive ${type}`);
    cells.push({id,type,inputs,output:id,group,bit,col}); return id;
  };
  const A=bits('a',8), PC=bits('pc',6), I=bits('inst',8), B=bits('data',8);
  const g=(type,id,inputs,group,bit,col)=>add(type,id,inputs,group,bit,col);
  const n7=g('NOT','not_op7',[I[7]],'decode',0,0);
  const we=g('AND','we',[n7,I[6]],'decode',1,0);
  const z1=Array.from({length:4},(_,i)=>g('OR',`zero_pair${i}`,[A[2*i],A[2*i+1]],'zero',i,0));
  const z2=[0,1].map(i=>g('OR',`zero_half${i}`,[z1[2*i],z1[2*i+1]],'zero',i*2,1));
  const z=g('NOR','zero',[...z2],'zero',1,2);
  const jz=g('AND','is_jz',[I[6],I[7]],'decode',2,0);
  const take=g('AND','take_jump',[jz,z],'decode',3,0);
  let carry=PC[0];
  for(let i=0;i<6;i++) {
    const inc=g(i?'XOR':'NOT',`pc_inc${i}`,i?[PC[i],carry]:[PC[i]],'pc',i,0);
    if(i>0&&i<5) carry=g('AND',`pc_carry${i}`,[PC[i],carry],'pc',i,1);
    const next=g('MUX',`pc_next${i}`,[inc,I[i],take],'pc',i,2);
    g('DFF',PC[i],[next,'clk'],'pc',i,3);
  }
  // A-B = A + ~B + 1. The carry rail is visible, including bit-zero's +1.
  let c='1';
  for(let i=0;i<8;i++) {
    const nb=g('NOT',`b_not${i}`,[B[i]],'alu',i,0);
    const p=g('XOR',`propagate${i}`,[A[i],nb],'alu',i,1);
    const sum=g(i?'XOR':'NOT',`difference${i}`,i?[p,c]:[p],'alu',i,2);
    if(i<7) {
      if(variant==='auto') {
        // Conventional full-adder cells, useful for comparing routing with the
        // educational carry MUX. Still only 2-input scalar primitive gates.
        const gen=g('AND',`generate${i}`,[A[i],nb],'alu',i,3);
        const prop=i?g('AND',`carry_propagate${i}`,[p,c],'alu',i,4):p;
        c=g('OR',`carry${i+1}`,[gen,prop],'alu',i,5);
      } else c=g(i?'MUX':'OR',`carry${i+1}`,i?[A[i],c,p]:[A[i],nb],'alu',i,3);
    }
    const loaded=g('MUX',`load_or_sub${i}`,[B[i],sum,I[7]],'acc',i,0);
    const held=g('MUX',`hold${i}`,[loaded,A[i],I[6]],'acc',i,1);
    g('DFF',A[i],[held,'clk'],'acc',i,2);
  }
  return {variant,cells,inputs:['clk',...I,...B],ports:{a:A,pc:PC,inst:I,data:B,we,addr:I.slice(0,6)},powerOn:0};
}
export function compile(netlist) {
  const known=new Set([...netlist.inputs,'0','1']);
  const ids=new Set();
  for(const c of netlist.cells) {
    if(!ALLOWED.has(c.type)||ids.has(c.output)) throw Error(`bad cell ${c.id}`);
    const arity=c.type==='NOT'?1:c.type==='MUX'?3:2;
    if(c.inputs.length!==arity) throw Error(`arity ${c.id}`);
    ids.add(c.output);
    if(c.type==='DFF') known.add(c.output);
  }
  const todo=netlist.cells.filter(c=>c.type!=='DFF'), order=[];
  while(todo.length) {
    const index=todo.findIndex(c=>c.inputs.every(n=>known.has(n)));
    if(index<0) throw Error('combinational loop or undriven signal: '+todo.map(c=>c.id));
    const [cell]=todo.splice(index,1); order.push(cell); known.add(cell.output);
  }
  for(const cell of netlist.cells) for(const n of cell.inputs) if(!known.has(n)) throw Error('undriven '+n);
  return {order,flops:netlist.cells.filter(c=>c.type==='DFF')};
}
export function evaluate(type, v) {
  const [a,b,s]=v;
  switch(type) {
    case 'NOT':return a^1;
    case 'AND':return a&b;
    case 'NAND':return (a&b)^1;
    case 'OR':return a|b;
    case 'NOR':return (a|b)^1;
    case 'XOR':return a^b;
    case 'XNOR':return (a^b)^1;
    case 'MUX':return s?b:a;
    default:throw Error('not combinational: '+type);
  }
}
export class Machine {
  constructor(netlist=buildCPU()) {
    this.netlist=netlist; Object.assign(this,compile(netlist));
    this.values={'0':0,'1':1,clk:0}; this.memory=new Uint8Array(64); this.cycles=0;
    this.powerOn();
  }
  word(names) {return names.reduce((n,s,i)=>n+(this.values[s]<<i),0);}
  setWord(names,n) {names.forEach((s,i)=>this.values[s]=(n>>i)&1);}
  get a(){return this.word(this.netlist.ports.a)}
  get pc(){return this.word(this.netlist.ports.pc)}
  get inst(){return this.word(this.netlist.ports.inst)}
  powerOn(image=new Uint8Array(64)) {
    if(image.length!==64) throw Error('memory image must be 64 bytes');
    this.memory.set(image); for(const c of this.flops) this.values[c.output]=0;
    this.cycles=0; this.values.clk=0; this.settle();
  }
  settle(inst=this.memory[this.pc],data=this.memory[inst&63]) {
    const p=this.netlist.ports;
    this.setWord(p.inst,inst); this.setWord(p.data,data);
    for(const c of this.order) this.values[c.output]=evaluate(c.type,c.inputs.map(n=>this.values[n]));
  }
  edge() {
    this.settle();
    const before={pc:this.pc,a:this.a,inst:this.inst,data:this.word(this.netlist.ports.data)};
    const next=this.flops.map(c=>this.values[c.inputs[0]]);
    const write=this.values[this.netlist.ports.we]?{address:this.inst&63,value:this.a}:null;
    // Both RAM and every DFF sample the PRE-edge values, then commit together.
    if(write) this.memory[write.address]=write.value;
    this.flops.forEach((c,i)=>this.values[c.output]=next[i]);
    this.cycles++; this.values.clk=1; this.settle();
    const after={pc:this.pc,a:this.a}; this.values.clk=0;
    return {cycle:this.cycles,before,after,write};
  }
}
export const OPS={LDA:0,STA:1,SUB:2,JZ:3};
export function assemble(source) {
  const image=new Uint8Array(64),used=new Set(),labels={},listing=[];
  const lines=source.split(/\r?\n/).map((text,i)=>({text,line:i+1}));
  const number=t=>/^0x[\da-f]+$/i.test(t)?parseInt(t,16):/^-?\d+$/.test(t)?Number(t):labels[t];
  function pass(emit) {
    let pc=0;
    for(const {text,line} of lines) {
      let s=text.replace(/;.*/,'').trim();
      if(!s)continue;
      const label=s.match(/^([a-z_]\w*):/i);
      if(label) {
        if(!emit){if(labels[label[1]]!==undefined)throw Error(`line ${line}: duplicate label`);labels[label[1]]=pc;}
        s=s.slice(label[0].length).trim(); if(!s)continue;
      }
      const [op0,...args]=s.split(/\s+/),op=op0.toUpperCase();
      if(op==='.ORG') {
        if(args.length!==1||!Number.isInteger(number(args[0]))||number(args[0])<0||number(args[0])>63) throw Error(`line ${line}: invalid .org`);
        pc=number(args[0]);continue;
      }
      if(pc>63)throw Error(`line ${line}: program exceeds 64 bytes`);
      if(args.length!==1||(!(op in OPS)&&op!=='.BYTE'))throw Error(`line ${line}: use LDA, STA, SUB, JZ, .byte, .org`);
      if(emit) {
        const n=number(args[0]);
        if(!Number.isInteger(n)||n<(op==='.BYTE'?-128:0)||n>(op==='.BYTE'?255:63))throw Error(`line ${line}: invalid operand ${args[0]}`);
        if(used.has(pc))throw Error(`line ${line}: overlapping address ${pc}`);
        used.add(pc);image[pc]=op==='.BYTE'?n&255:(OPS[op]<<6)|n;
        listing.push({address:pc,byte:image[pc],source:s,line});
      }
      pc++;
    }
  }
  pass(false);pass(true);return {image,labels,listing};
}
export function disassemble(byte) {return `${['lda','sta','sub','jz'][byte>>6]} 0x${(byte&63).toString(16).padStart(2,'0')}`;}
export const programs=[
  {name:'load / store / wraparound',cycles:7,expected:{60:255,61:42},source:`lda zero
sub one
sta underflow
lda answer
sta result
lda zero
done: jz done
.org 56
zero: .byte 0
one: .byte 1
answer: .byte 42
.org 60
underflow: .byte 0
result: .byte 0`},
  {name:'countdown loop',cycles:40,expected:{60:0},source:`loop: lda counter
sub one
sta counter
jz done
lda zero
jz loop
done: jz done
.org 56
one: .byte 1
zero: .byte 0
.org 60
counter: .byte 4`},
  {name:'multiply 6 × 7',cycles:100,expected:{60:42},source:`loop: lda result
sub minus_six
sta result
lda count
sub one
sta count
jz finished
lda zero
jz loop
finished: lda zero
park: jz park
.org 54
minus_six: .byte -6
one: .byte 1
zero: .byte 0
count: .byte 7
.org 60
result: .byte 0`},
  {name:'fibonacci: 8 iterations',cycles:200,expected:{60:21,61:34},source:`loop: lda zero
sub previous
sub current
sta negative_sum
lda current
sta previous
lda zero
sub negative_sum
sta current
lda count
sub one
sta count
jz finished
lda zero
jz loop
finished: lda zero
park: jz park
.org 55
zero: .byte 0
one: .byte 1
count: .byte 8
negative_sum: .byte 0
.org 60
previous: .byte 0
current: .byte 1`},
  {name:'self-modifying code',cycles:8,expected:{4:197,60:0},source:`lda patched_jump
sta target
lda zero
jz target
target: sta result
park: jz park
.org 56
patched_jump: .byte 197
zero: .byte 0
.org 60
result: .byte 0`}
];
