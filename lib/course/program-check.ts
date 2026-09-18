import { buildComputer, powerOn, step, word, Computer } from '../computer'
import { assemble } from '../computer/programs'
export const doubleStarter=`; read x at address 50, write 2*x at 60
; add your instructions here
lda zero
park: jz park
.org 56
zero: .byte 0`
export const doubleSolution=`lda zero
sub x
sta negative
lda x
sub negative
sta result
lda zero
park: jz park
.org 50
x: .byte 0
.org 56
zero: .byte 0
negative: .byte 0
.org 60
result: .byte 0`
export const testInputs=[0,1,3,127,128,255]
export function checkProgram(source:string,cpu:Computer=buildComputer('manual')){
    const {image}=assemble(source),rows:{input:number,expected:number,actual:number,edges:number,parked:boolean,ok:boolean}[]=[]
    for(const x of testInputs){const ram=image.slice();ram[50]=x;ram[60]=0;powerOn(cpu,ram);let edges=0,parked=false
        for(;edges<512;edges++){const pc=word(cpu.pc),a=word(cpu.a),inst=cpu.memory.bytes[pc];if(edges>0&&a===0&&(inst>>6)===3&&(inst&63)===pc){parked=true;break}step(cpu)}
        const expected=(x*2)&255,actual=cpu.memory.bytes[60];rows.push({input:x,expected,actual,edges,parked,ok:parked&&actual===expected})
    }
    return rows
}
