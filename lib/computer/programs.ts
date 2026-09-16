export const OPS={LDA:0,STA:1,SUB:2,JZ:3};
export function assemble(source) {
  const image=new Uint8Array(64),used=new Set(),labels: Record<string, number>={},listing: {address:number,byte:number,source:string,line:number}[]=[];
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
