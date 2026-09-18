import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { lessons } from '../lib/course/lessons'
import { readProgress,emptyProgress,isComplete } from '../lib/course/progress'
import { labIds,makeLab,brokenLab,checkLab,auditLab,pulse } from '../lib/course/circuits'
import { switchCircuit,switchModes,resolveSwitches } from '../lib/course/transistors'
import { serializeCircuit,deserializeCircuit } from '../lib/serialization'
import { Circuit } from '../lib/circuit'
import { Wire,Gate,DFFGate,Memory } from '../components/gates'
import { checkProgram,doubleSolution,doubleStarter,testInputs } from '../lib/course/program-check'
import { buildComputer,word } from '../lib/computer'

test('all thirteen chapters are substantive, every widget exists, checkpoints match content',()=>{
    assert.equal(lessons.length,13);assert.equal(new Set(lessons.map(l=>l.slug)).size,13)
    for(const l of lessons){const text=fs.readFileSync(`course/${l.slug}.md`,'utf8');assert(text.split(/\s+/).length>=400,l.slug);assert(!/TODO|coming soon|placeholder/i.test(text),l.slug)
        const widgets=[...text.matchAll(/@@([\w:-]+)/g)].map(m=>m[1].replace(/^lab:/,''));assert.deepEqual(widgets,l.labs,l.slug)
        for(const id of l.labs)assert([...labIds,'computer','transistors','programming'].includes(id as any))
        assert.equal(l.questions.length,2);for(const q of l.questions){assert(q.choices[q.answer]);assert(q.why.length>30);assert(q.hint)}
    }
})
test('saved progress does not award unchecked lessons or accept corrupt data',()=>{
    assert.deepEqual(readProgress('{oops'),emptyProgress());assert.deepEqual(readProgress('null'),emptyProgress())
    const p=emptyProgress(),l=lessons[0];assert.equal(isComplete(l,p),false)
    p.labs.transistors=true;l.questions.forEach((q,i)=>p.answers[`${l.slug}:${i}`]=q.answer)
    assert.equal(isComplete(l,p),true);assert.equal(isComplete(lessons[1],p),false)
    assert.deepEqual(readProgress(JSON.stringify(p)),p)
    delete p.labs.transistors;assert.equal(isComplete(l,p),false)
})
test('switch model enumerates transistor, NOT, NAND, NOR and OR cases and preserves floating nodes',()=>{
    for(const m of switchModes)for(const a of [0,1] as const)for(const b of [0,1] as const){
        const {switches}=switchCircuit(m),value=resolveSwitches(switches,a,b).out
        assert.equal(value,m==='n switch'?a?0:'Z':m==='p switch'?a?'Z':1:m==='not'?1-a:m==='nand'?1-(a&b):m==='nor'?1-(a|b):a|b,`${m}/${a}${b}`)
    }
    const short=resolveSwitches([{kind:'n',gate:'a',from:'vdd',to:'out',x:0,y:0},{kind:'n',gate:'a',from:'out',to:'gnd',x:0,y:0}],1,0)
    assert.equal(short.out,'X')
})
for(const id of [...labIds,'computer'] as const){
    test(`${id}: native gate objects, exact geometry, complete reference, real missing-wire failure and repair`,()=>{
        const lab=makeLab(id);assert(lab.circuit instanceof Circuit);assert(lab.circuit.gates.every(g=>g.item instanceof Gate));assert(lab.circuit.wires.every(w=>w.item instanceof Wire))
        assert.equal(auditLab(lab).overlaps,0);assert.equal(checkLab(id,lab.circuit).ok,true,id)
        const broken=brokenLab(lab);assert.equal(broken.wires.length,lab.circuit.wires.length-1);assert.equal(checkLab(id,broken).ok,false)
        const originalPaths=new Set(broken.wires.map(w=>JSON.stringify(w.item.path)))
        const missing=lab.circuit.wires.find(w=>!originalPaths.has(JSON.stringify(w.item.path)))!.item
        broken.add(new Wire(missing.path));assert.equal(checkLab(id,broken).ok,true)
        const restored=deserializeCircuit(serializeCircuit(lab.circuit));assert.equal(checkLab(id,restored).ok,true)
        if(id!=='computer')assert(!lab.circuit.gates.some(g=>g.item instanceof Memory))
        else assert.equal(lab.circuit.gates.filter(g=>g.item instanceof DFFGate).length,14)
    })
}
test('passing checks does not mutate the learner circuit or consume its state',()=>{
    const l=makeLab('counter');pulse(l.circuit);const before=JSON.stringify(serializeCircuit(l.circuit));assert(checkLab('counter',l.circuit).ok);assert.equal(JSON.stringify(serializeCircuit(l.circuit)),before)
})
test('the final programming exercise runs six cases in the real merged gate-level computer',()=>{
    const cpu=buildComputer('manual'),bad=checkProgram(doubleStarter,cpu);assert(bad.some(r=>!r.ok))
    const good=checkProgram(doubleSolution,cpu);assert.deepEqual(good.map(r=>r.input),testInputs);assert(good.every(r=>r.ok),JSON.stringify(good));assert.equal(word(cpu.a),0)
    const memorized=checkProgram(doubleSolution.replace('lda x\nsub negative','lda six').replace('.org 56','.org 55\nsix: .byte 6\n.org 56'),cpu);assert(memorized.some(r=>!r.ok))
    assert.throws(()=>checkProgram('LDA 64',cpu),/invalid operand/)
})
test('broken geometry cannot pass just because unconnected signals default to zero',()=>{
    const l=makeLab('nand-and'),c=deserializeCircuit(serializeCircuit(l.circuit));c.gates[0].coords=c.gates[1].coords;c.invalidate();assert.equal(checkLab('nand-and',c).ok,false)
})
test('native editor runtime and renderer remain the only gate-level course execution path',()=>{
    const page=fs.readFileSync('components/course/CircuitLab.tsx','utf8');assert(page.includes('CircuitBoard'));assert(page.includes('useCircuit'));assert(!page.includes('<iframe'))
    const c=fs.readFileSync('lib/course/circuits.ts','utf8');assert(c.includes('new Circuit()'));assert(c.includes('new Wire('));assert(c.includes('pulse('));assert(c.includes("from '../../components/gates'"))
})


test('truth-table enumeration preserves the actual editor circuit and its selected input values',()=>{
    const {truthTable}=require('../lib/truthtable')
    const lab=makeLab('half'), c=lab.circuit
    const buttons=lab.inputs.map(name=>c.gates.find(g=>g.item.name===name)!.item)
    const outputs=lab.outputs.map(name=>c.gates.find(g=>g.item.name===name)!.item)
    buttons[0].set('Y',true);buttons[1].set('Y',false);c.update()
    const before=JSON.stringify(serializeCircuit(c)), rows=truthTable(c,buttons,outputs)
    assert.equal(JSON.stringify(serializeCircuit(c)),before)
    assert.equal(rows.length,4)
    assert.deepEqual(rows.map((r:any)=>r.output),[[false,false],[true,false],[true,false],[false,true]])
})
