// All CPU cells are scalar primitives. Groups/bit/column are drawing annotations only.
export const ALLOWED = new Set(['AND','NAND','OR','NOR','XOR','XNOR','MUX','NOT','DFF']);
const bits = (name:string, n:number) => Array.from({length:n}, (_,i)=>`${name}[${i}]`);
export function buildCPU() {
  const cells:{type:string,id:string,inputs:string[],output:string,group:string,bit:number,col:number}[]=[];
  const add=(type:string,id:string,inputs:string[],group:string,bit=0,col=0)=>{
    if(!ALLOWED.has(type)) throw Error(`non-primitive ${type}`);
    cells.push({id,type,inputs,output:id,group,bit,col}); return id;
  };
  const A=bits('a',8), PC=bits('pc',6), I=bits('inst',8), B=bits('data',8);
  const g=add;
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
      c=g(i?'MUX':'OR',`carry${i+1}`,i?[A[i],c,p]:[A[i],nb],'alu',i,3);
    }
    const loaded=g('MUX',`load_or_sub${i}`,[B[i],sum,I[7]],'acc',i,0);
    const held=g('MUX',`hold${i}`,[loaded,A[i],I[6]],'acc',i,1);
    g('DFF',A[i],[held,'clk'],'acc',i,2);
  }
  return {cells,inputs:['clk',...I,...B],ports:{a:A,pc:PC,inst:I,data:B,we,addr:I.slice(0,6)},powerOn:0};
}
