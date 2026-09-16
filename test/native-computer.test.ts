import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { Circuit } from '../lib/circuit'
import { coord, isPointOnSegment } from '../lib/coord'
import { Wire } from '../components/gates/core/Wire'
import { Gate } from '../components/gates/core/Gate'
import { ANDGate } from '../components/gates/ANDGate'
import { XORGate } from '../components/gates/XORGate'
import { NOTGate } from '../components/gates/NOTGate'
import { Button } from '../components/gates/Button'
import { DFF } from '../components/gates/DFF'
import { Cross } from '../components/gates/Cross'
import { Memory } from '../components/gates/Memory'
import { buildComputer, clockCycle, readWord, restartComputer, validateNative, Variant, NativeComputer } from '../lib/computer/build'
import { validateGeometry } from '../lib/computer/validate'
import { assemble, programs } from '../lib/computer/programs'

const computers=new Map<Variant,NativeComputer>()
const get=(variant:Variant)=>{if(!computers.has(variant))computers.set(variant,buildComputer(variant));return computers.get(variant)!}
const reference=(state:{a:number,pc:number,memory:Uint8Array})=>{
    const inst=state.memory[state.pc],address=inst&63,data=state.memory[address];let pc=(state.pc+1)&63
    switch(inst>>6){case 0:state.a=data;break;case 1:state.memory[address]=state.a;break;case 2:state.a=(state.a-data)&255;break;case 3:if(state.a===0)pc=address}
    state.pc=pc
}

test('the original primitive gate classes retain their truth tables',()=>{
    for(const A of [false,true])for(const B of [false,true]){
        const and=new ANDGate(),xor=new XORGate(),not=new NOTGate()
        for(const g of [and,xor]){g.set('A',A);g.set('B',B);g.update()}
        not.set('A',A);not.update()
        assert.equal(and.get('Y'),A&&B);assert.equal(xor.get('Y'),A!==B);assert.equal(not.get('Y'),!A)
    }
})
test('wires do not invent shorts from duplicate points or erase U-turns',()=>{
    assert.equal(isPointOnSegment(coord([99,99]),coord([0,0]),coord([0,0])),false)
    const w=new Wire([[0,0],[2,0],[0,0]])
    assert.equal(w.path.length,3);assert.equal(w.has(coord([1,0])),true)
    assert.equal(new Wire([[0,0],[0,0]]).has(coord([9,9])),false)
})
test('native dffs sample together; no ripple-through or repeated high-level clocks',()=>{
    for(const reverse of [false,true]){
        const c=new Circuit(),clk=new Button('clk'),data=new Button('data'),a=new DFF('a'),b=new DFF('b')
        clk.set('Y',false);data.set('Y',true)
        c.add(clk,[0,0]).add(data,[0,6]).add(a,[10,0]).add(b,[20,0])
        for(const p of [ [[2,7],[5,7],[5,1],[10,1]], [[2,1],[3,1],[3,4],[11,4],[11,3]], [[11,4],[21,4],[21,3]], [[12,1],[20,1]] ])c.add(new Wire(p as [number,number][]))
        if(reverse)c.gates.reverse()
        c.update();clk.click();c.update()
        assert.equal(a.get('Q'),true);assert.equal(b.get('Q'),false)
        c.update();assert.equal(b.get('Q'),false)
        clk.click();c.update();clk.click();c.update();assert.equal(b.get('Q'),true)
    }
})
test('deep clock paths through actual Cross gates settle before dff sampling',()=>{
    const c=new Circuit(),clk=new Button('clk'),data=new Button('data'),d=new DFF('d')
    clk.set('Y',false);data.set('Y',true);c.add(clk,[0,0]).add(data,[0,6])
    let from=coord([2,1])
    for(let i=0;i<50;i++){
        const x=4+i*3,g=new Cross();c.add(g,[x,0]);c.add(new Wire([from,coord([x,0])]))
        from=coord([x+1,1])
    }
    c.add(d,[160,0]).add(new Wire([from,coord([158,1]),coord([158,4]),coord([161,4]),coord([161,3])]))
    c.add(new Wire([[2,7],[159,7],[159,1],[160,1]]))
    c.update();clk.click();c.update();assert.equal(d.get('Q'),true)
})
for(const variant of ['manual','auto'] as const){
    test(`${variant}: actual Circuit, original gate classes, native wires and Cross components`,()=>{
        const c=get(variant)
        assert.ok(c.circuit instanceof Circuit);assert.ok(c.memory instanceof Memory)
        assert.ok(c.circuit.gates.every(g=>g.item instanceof Gate));assert.ok(c.circuit.wires.every(w=>w.item instanceof Wire))
        assert.ok(c.circuit.gates.some(g=>g.item instanceof ANDGate));assert.ok(c.circuit.gates.some(g=>g.item instanceof XORGate))
        assert.equal(c.circuit.gates.filter(g=>g.item instanceof DFF).length,14)
        assert.equal(c.circuit.gates.filter(g=>g.item instanceof Cross).length,c.metrics.crossovers)
        const allowed=new Set(['AND','OR','NOR','NOT','XOR','MUX','DFF','Cross','Memory','Button'])
        assert.ok(c.circuit.gates.every(g=>allowed.has((g.item.constructor as any).type)))
        assert.equal(c.circuit.unconnected!.length,0)
    })
    test(`${variant}: native geometry extraction, body clearance, and no naked wire crossings`,()=>{
        const c=get(variant);assert.equal(validateNative(c.circuit,c.pins,c.byName).shorts,0)
        assert.equal(validateGeometry(c).unisolatedIntersections,0)
    })
    test(`${variant}: all five programs match reference registers and every memory byte after each edge`,()=>{
        const c=get(variant)
        for(const p of programs){
            const image=assemble(p.source).image;restartComputer(c,image)
            const state={a:0,pc:0,memory:image.slice()}
            for(let i=0;i<p.cycles;i++){
                reference(state);clockCycle(c)
                assert.equal(readWord(c.byName,'a',8),state.a,p.name+': A')
                assert.equal(readWord(c.byName,'pc',6),state.pc,p.name+': PC')
                assert.deepEqual(c.memory.bytes,state.memory,p.name+': memory')
            }
            for(const [addr,value] of Object.entries(p.expected))assert.equal(c.memory.bytes[+addr],value,p.name)
        }
    })
    test(`${variant}: randomized programs, PC wrap, and self-modifying stores`,()=>{
        const c=get(variant);let seed=0x541888
        const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)>>>24)
        for(let trial=0;trial<24;trial++){
            const image=Uint8Array.from({length:64},random),state={a:0,pc:0,memory:image.slice()};restartComputer(c,image)
            for(let i=0;i<128;i++){
                reference(state);clockCycle(c)
                assert.equal(readWord(c.byName,'a',8),state.a);assert.equal(readWord(c.byName,'pc',6),state.pc);assert.deepEqual(c.memory.bytes,state.memory)
            }
        }
    })
    test(`${variant}: deleting a native Wire changes execution; replacing it repairs the computer`,()=>{
        const c=get(variant),image=new Uint8Array(64);image[0]=56;image[56]=42;restartComputer(c,image)
        const a1=c.byName.get('a[1]')!,g=c.circuit.gates.find(g=>g.item===a1)!,pin=g.coords.add(a1.pins.D.coord)
        const index=c.circuit.wires.findIndex(w=>w.item.has(pin));assert.ok(index>=0)
        const wire=c.circuit.wires[index].item;c.circuit.remove(index,wire)
        assert.throws(()=>validateNative(c.circuit,c.pins,c.byName),/undriven|open/)
        clockCycle(c);assert.equal(readWord(c.byName,'a',8),40)
        c.circuit.add(wire);validateNative(c.circuit,c.pins,c.byName);restartComputer(c,image);clockCycle(c)
        assert.equal(readWord(c.byName,'a',8),42)
    })
}
test('assembler errors are rejected before changing memory',()=>{
    for(const s of ['lda 64','add 5','lda missing','.byte 999','.byte 0\n.org 0\n.byte 0','.org 63\n.byte 1\n.byte 2'])assert.throws(()=>assemble(s))
})
