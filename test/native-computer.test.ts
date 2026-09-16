import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Circuit } from '../lib/circuit'
import { Gate, Wire, Button, ANDGate, XORGate, NOTGate, DFFGate, Cross } from '../components/gates'
import { buildComputer, powerOn, step, word } from '../lib/computer'
import { validateComputer } from '../lib/computer/validate'
import { assemble, programs } from '../lib/computer/programs'
import { serializeCircuit, deserializeCircuit } from '../lib/serialization'
import { coord, isPointOnSegment } from '../lib/coord'

const setWord=(gates:Gate[],n:number)=>gates.forEach((g,i)=>g.set('Q',!!(n&(1<<i))))
const nextWord=(gates:Gate[])=>gates.reduce((n,g,i)=>n+(g.get('D')?1<<i:0),0)

for(const variant of ['manual','auto'] as const){
    let cpu: ReturnType<typeof buildComputer>
    test(`${variant}: real editor objects; every routed pin has its intended driver`,()=>{
        cpu=buildComputer(variant)
        assert(cpu.circuit instanceof Circuit)
        assert(cpu.circuit.gates.every(g=>g.item instanceof Gate))
        assert(cpu.circuit.wires.every(w=>w.item instanceof Wire))
        assert(cpu.circuit.gates.some(g=>g.item instanceof ANDGate))
        assert(cpu.circuit.gates.some(g=>g.item instanceof Cross))
        assert(cpu.circuit.gates.every(g=>['AND','NAND','OR','NOR','XOR','XNOR','MUX','NOT','DFF','Cross','Memory','Button'].includes(g.item.type)))
        const report=validateComputer(cpu);assert.equal(report.dffs,14);assert.equal(report.opens+report.shorts+report.overlaps+report.wireThroughGates,0)
        assert(cpu.layout.metrics.area<=27000)
        if(variant==='manual')assert(cpu.layout.metrics.manualConnections>=35)
    })
    test(`${variant}: all 256 accumulator × 256 operand × 4 opcodes via Circuit.update`,()=>{
        powerOn(cpu);cpu.clock.set('Y',false)
        for(let a=0;a<256;a++)for(let b=0;b<256;b++)for(let op=0;op<4;op++){
            setWord(cpu.a,a);setWord(cpu.pc,0);cpu.memory.bytes[0]=(op<<6)|56;cpu.memory.bytes[56]=b
            cpu.circuit.update()
            assert.equal(nextWord(cpu.a),op===0?b:op===2?(a-b)&255:a)
            assert.equal(nextWord(cpu.pc),op===3&&a===0?56:1)
            assert.equal(cpu.memory.get('WE'),op===1)
        }
    })
    test(`${variant}: every PC and branch target, zero and nonzero`,()=>{
        for(let pc=0;pc<64;pc++)for(let target=0;target<64;target++)for(const a of [0,1,128]){
            setWord(cpu.a,a);setWord(cpu.pc,pc);cpu.memory.bytes[pc]=192|target;cpu.circuit.update()
            assert.equal(nextWord(cpu.pc),a===0?target:(pc+1)&63)
        }
    })
    test(`${variant}: five complete programs and all memory bytes agree after every edge`,()=>{
        for(const program of programs){
            const ram=assemble(program.source).image;powerOn(cpu,ram);let a=0,pc=0
            for(let i=0;i<program.cycles;i++){
                const inst=ram[pc],op=inst>>6,address=inst&63,data=ram[address];let next=(pc+1)&63
                if(op===0)a=data;else if(op===1)ram[address]=a;else if(op===2)a=(a-data)&255;else if(a===0)next=address
                pc=next;step(cpu);assert.equal(word(cpu.a),a,program.name);assert.equal(word(cpu.pc),pc,program.name);assert.deepEqual(cpu.memory.bytes,ram)
            }
            for(const [address,value]of Object.entries(program.expected))assert.equal(cpu.memory.bytes[+address],value,program.name)
        }
    })
    test(`${variant}: 20 random unified-memory, self-modifying programs`,()=>{
        let seed=0x51d054aa;const random=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0
        for(let trial=0;trial<20;trial++){
            const ram=Uint8Array.from({length:64},()=>random()>>>24);powerOn(cpu,ram);let a=0,pc=0
            for(let cycle=0;cycle<128;cycle++){
                const inst=ram[pc],address=inst&63,data=ram[address];let next=(pc+1)&63
                switch(inst>>6){case 0:a=data;break;case 1:ram[address]=a;break;case 2:a=(a-data)&255;break;case 3:if(!a)next=address}
                pc=next;step(cpu);assert.equal(word(cpu.a),a);assert.equal(word(cpu.pc),pc);assert.deepEqual(cpu.memory.bytes,ram)
            }
        }
    })
    test(`${variant}: exported native Circuit round-trips and continues execution`,()=>{
        powerOn(cpu,assemble(programs[2].source).image);for(let i=0;i<23;i++)step(cpu)
        const data=serializeCircuit(cpu.circuit),restored=deserializeCircuit(JSON.parse(JSON.stringify(data)))
        const clock=restored.gates.find(g=>g.item.type==='Button')!.item
        const a=cpu.a.map(g=>restored.gates.find(h=>h.item.name===g.name)!.item),pc=cpu.pc.map(g=>restored.gates.find(h=>h.item.name===g.name)!.item)
        for(let i=0;i<20;i++){step(cpu);clock.set('Y',true);restored.update();clock.set('Y',false);restored.update();assert.equal(word(a),word(cpu.a));assert.equal(word(pc),word(cpu.pc))}
    })
    test(`${variant}: cutting an actual Wire changes execution (no hidden evaluator)`,()=>{
        const image=new Uint8Array(64);image[0]=56;image[56]=1;powerOn(cpu,image)
        const connection=cpu.circuit.connections!.find(c=>c.to===cpu.a[0]&&c.toPin==='D')!,index=cpu.circuit.wires.findIndex(w=>w.item===connection.via),saved=cpu.circuit.wires[index]
        cpu.circuit.remove(index,saved.item);assert.throws(()=>validateComputer(cpu));step(cpu);assert.notEqual(word(cpu.a),1)
        cpu.circuit.wires.splice(index,0,saved);cpu.circuit.invalidate();validateComputer(cpu)
    })
    test(`${variant}: real Cross behavior and gate behavior are not decorative`,()=>{
        const cross=cpu.circuit.gates.find(g=>g.item instanceof Cross)!.item
        const old=cross.rotation;cross.rotation+=180;cpu.circuit.invalidate();assert.throws(()=>validateComputer(cpu));cross.rotation=old;cpu.circuit.invalidate();validateComputer(cpu)
        const xor=cpu.nodes.find(n=>n.id==='propagate0')!.gate,update=xor.update
        xor.update=function(){return this.set('Y',!((this.get('A')||false)!==(this.get('B')||false)))}
        const image=new Uint8Array(64);image[0]=128|56;image[56]=1;powerOn(cpu,image);step(cpu);assert.notEqual(word(cpu.a),255)
        xor.update=update;powerOn(cpu)
    })
}

test('DFFs snapshot together, including a swapped register pair; repeated update is not another edge',()=>{
    const c=new Circuit(),clock=new Button(),a=new DFFGate(),b=new DFFGate()
    c.add(a,[8,2]).add(b,[8,8]).add(clock,[0,0])
    c.add(new Wire([[2,1],[4,1],[4,10],[8,10]])).add(new Wire([[4,4],[8,4]]))
    c.add(new Wire([[10,3],[12,3],[12,6],[6,6],[6,8],[8,8]]))
    c.add(new Wire([[10,9],[14,9],[14,0],[6,0],[6,2],[8,2]]))
    a.powerOn(true);clock.set('Y',false);c.update();clock.set('Y',true);c.update()
    assert.equal(a.get('Q'),false);assert.equal(b.get('Q'),true)
    c.update();assert.equal(a.get('Q'),false);assert.equal(b.get('Q'),true)
})
test('the original AND/XOR gates and geometric wire junctions still simulate a half-adder',()=>{
    const c=new Circuit(),a=new Button(),b=new Button(),sum=new XORGate(),carry=new ANDGate()
    c.add(a,[0,0]).add(b,[0,8]).add(sum,[10,0]).add(carry,[10,6])
    c.add(new Wire([[2,1],[4,1],[4,0],[10,0]])).add(new Wire([[4,1],[4,6],[10,6]]))
    c.add(new Wire([[2,9],[6,9],[6,2],[10,2]])).add(new Wire([[6,8],[10,8]]))
    for(let av=0;av<2;av++)for(let bv=0;bv<2;bv++){a.set('Y',!!av);b.set('Y',!!bv);c.update();assert.equal(sum.get('Y'),!!(av^bv));assert.equal(carry.get('Y'),!!(av&bv))}
})
test('interior/interior wire crossings stay separate; moved gates invalidate connectivity',()=>{
    const c=new Circuit(),a=new Button(),b=new Button(),gate=new NOTGate()
    c.add(a,[0,0]).add(b,[3,-4]).add(gate,[10,0]);c.add(new Wire([[2,1],[10,1]])).add(new Wire([[5,-3],[5,4]]))
    c.update();assert.equal(c.nets.length,2);assert.equal(c.unconnected!.length,0)
    const clone=c.clone();clone.gates[2].coords=coord([10,3]);clone.invalidate();clone.update();assert.equal(clone.unconnected!.length,1)
    assert.equal(c.unconnected!.length,0)
})
test('Wire preserves backtracking, and a zero-length segment does not contain every point',()=>{
    const w=new Wire([[0,0],[3,0],[1,0]]);assert.equal(w.path.length,3)
    assert.equal(isPointOnSegment(coord([3,2]),coord([0,0]),coord([0,0])),false)
})
test('assembler errors; no separate simulator or iframe in /computer',()=>{
    for(const s of ['lda 64','lda missing','x: .byte 0\nx: .byte 0','.org 63\n.byte 0\n.byte 0','.byte 1\n.org 0\n.byte 2','add 1','lda 1 2','.byte 256'])assert.throws(()=>assemble(s))
    const page=fs.readFileSync('pages/computer/index.tsx','utf8');assert(page.includes('CircuitBoard'));assert(page.includes('useCircuit'));assert(!page.includes('<iframe'))
    assert(!fs.existsSync('public/gate-computer/core.mjs'))
})
