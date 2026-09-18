import { useEffect, useRef, useState } from 'react'
import { CircuitBoard, Frame, Selection } from '../CircuitBoard'
import { Toolbox, Tool } from '../Toolbox'
import { Circuit } from '../../lib/circuit'
import { Button, DFFGate, Memory } from '../gates'
import { useCircuit } from '../../hooks/useCircuit'
import { serializeCircuit, deserializeCircuit } from '../../lib/serialization'
import { makeLab, Lab, LabId, brokenLab, checkLab, setInput, readOutput, readWord, pulse } from '../../lib/course/circuits'
import { circuitKey } from '../../lib/course/progress'
import { assemble, programs } from '../../lib/computer/programs'

const safeWord=(c:Circuit,p:string,n:number)=>{try{return readWord(c,p,n)}catch{return 0}}
export function CircuitLab({id,passed,onResult}:{id:LabId,passed:boolean,onResult:(passed:boolean)=>void}){
    const uc=useCircuit(()=>new Circuit(),false),[lab,setLab]=useState<Lab|null>(null),reference=useRef<Lab|null>(null)
    const [tool,setTool]=useState<Tool>('Interact'),[selection,select]=useState<Selection|null>(null),[frame,setFrame]=useState<Frame>()
    const [status,setStatus]=useState('building native circuit…'),[attempt,setAttempt]=useState(false),[busy,setBusy]=useState(false),[storage,setStorage]=useState('')
    const [example,setExample]=useState(0),[cycles,setCycles]=useState(0)
    const save=(c=uc.getCircuit(),isAttempt=attempt)=>{
        try{localStorage.setItem(circuitKey(id),JSON.stringify({attempt:isAttempt,circuit:serializeCircuit(c)}));setStorage('saved on this device')}
        catch{setStorage('browser storage unavailable; leave this page open to keep edits')}
    }
    const refresh=()=>{try{uc.interact()}catch(e){setStatus(String((e as Error).message))}}
    useEffect(()=>{
        let cancelled=false
        const timer=setTimeout(()=>{
            try{
                const l=makeLab(id);if(cancelled)return;reference.current=l;setLab(l);setFrame({...l.frame,key:Date.now()})
                let c=l.circuit,active=false,message='reference circuit · toggle the inputs to explore. choose repair or start from parts to build.'
                if(id==='computer'){const memory=c.gates.find(g=>g.item instanceof Memory)!.item as Memory;memory.load(assemble(programs[0].source).image);c.update()}
                c=deserializeCircuit(serializeCircuit(c)) // keep the worked reference immutable
                try{const raw=localStorage.getItem(circuitKey(id));if(raw){const s=JSON.parse(raw);if(s.circuit.gates.length>5000||s.circuit.wires.length>15000)throw Error('saved circuit too large');c=deserializeCircuit(s.circuit);active=!!s.attempt;message='restored your saved native circuit.'}}catch{message='saved circuit could not be restored; showing reference.'}
                uc.setCircuit(c);setAttempt(active);setStatus(message)
            }catch(e){setStatus(String((e as Error).message))}
        },20)
        return()=>{cancelled=true;clearTimeout(timer)}
    },[id]) // eslint-disable-line react-hooks/exhaustive-deps
    const replace=(mode:'reference'|'repair'|'parts')=>{
        if(!reference.current)return
        const l=reference.current;let c=mode==='repair'?brokenLab(l):deserializeCircuit(serializeCircuit(l.circuit))
        if(mode==='parts'){c.wires=[];c.invalidate()}
        uc.setCircuit(c);setAttempt(mode!=='reference');setTool(mode==='reference'?'Interact':'Wire');select(null);setCycles(0)
        setFrame({...l.frame,key:Date.now()});setStatus(mode==='reference'?'reference restored.':'connect the circuit, then check wiring.');onResult(false);refresh();save(c,mode!=='reference')
    }
    const edited=()=>{setAttempt(true);onResult(false);refresh();save(uc.getCircuit(),true);setStatus('circuit edited. check wiring when ready.')}
    const toggle=(name:string)=>{try{const c=uc.getCircuit(),g=c.gates.find(g=>g.item instanceof Button&&g.item.name===name)?.item;if(!g)throw Error('missing input '+name);setInput(c,name,!g.get('Y'));refresh();save()}catch(e){setStatus(String(e))}}
    const check=()=>{setBusy(true);setTimeout(()=>{const r=checkLab(id,uc.getCircuit());setStatus(r.message+(r.ok&&!attempt?' this is the reference; choose a build exercise for the checkpoint.':''));if(attempt)onResult(r.ok);setBusy(false);save()},20)}
    const cpuLoad=(i:number)=>{
        const c=uc.getCircuit(),memory=c.gates.find(g=>g.item instanceof Memory)?.item as Memory
        if(!memory)return
        setInput(c,'clock',false);for(const g of c.gates)if(g.item instanceof DFFGate)g.item.powerOn()
        memory.load(assemble(programs[i].source).image);setCycles(0);refresh();save()
    }
    const tick=(n=1)=>{try{for(let i=0;i<n;i++)pulse(uc.getCircuit(),lab!.clock);setCycles(v=>v+n);refresh();save()}catch(e){setStatus(String((e as Error).message))}}
    const fitGroup=(name:string)=>{
        if(!lab)return
        const nodes=(reference.current!.nodes as any[]).filter(n=>name==='accumulator'?['acc','alu'].includes(n.group):n.group==='pc')
        const x=Math.min(...nodes.map(n=>n.x))-3,y=Math.min(...nodes.map(n=>n.y))-6
        setFrame({x,y,width:Math.max(...nodes.map(n=>n.x+n.w))-x+3,height:Math.max(...nodes.map(n=>n.y+n.h))-y+5,key:Date.now()})
    }
    useEffect(()=>{
        if(!lab)return
        // Public inspection of the ACTUAL native objects, also used in regression tests.
        const w=window as any;w.courseLabs ||= {};w.courseLabs[id]={get circuit(){return uc.getCircuit()},reference:reference.current,check:()=>checkLab(id,uc.getCircuit())}
        return()=>{delete w.courseLabs?.[id]}
    },[id,lab,uc.getCircuit])
    const c=uc.circuit,allowed=id.startsWith('nand-')?['NAND','Button','Lightbulb','Cross']:['AND','NAND','OR','NOR','XOR','XNOR',...(id==='mux'?[]:['MUX']),'NOT','DFF','Cross','Button','Lightbulb']
    const data=id==='byte'?safeWord(c,'q',8):0
    const memory=c.gates.find(g=>g.item instanceof Memory)?.item as Memory|undefined
    return <section className={`circuit-lab ${id==='computer'?'capstone':''}`} data-lab={id} aria-label={lab?.title||id}>
        <div className="lab-head"><div><span className="eyebrow">native circuit lab</span><h3>{lab?.title||'loading circuit'}</h3></div><span className={`badge ${passed?'done':''}`}>{passed?'✓ checked':attempt?'your build':'explore → build'}</span></div>
        {lab&&<>
            <p className="lab-task">{lab.task}</p>
            <div className="lab-actions"><button onClick={()=>replace('repair')}>repair challenge</button><button onClick={()=>replace('parts')}>start from parts</button><button onClick={()=>replace('reference')}>reference</button><button onClick={()=>setFrame({...lab.frame,key:Date.now()})}>fit</button><button className="accent" disabled={busy} onClick={check}>{busy?'checking…':'check wiring'}</button></div>
            <Toolbox tool={tool} setTool={setTool} allowed={allowed} hotkeys={false}/>
            {id==='computer'&&<div className="lab-actions"><button onClick={()=>fitGroup('accumulator')}>accumulator</button><button onClick={()=>fitGroup('pc')}>program counter</button><a href="/computer" target="_blank" rel="noreferrer">full workbench ↗</a></div>}
            <div className="native-board"><CircuitBoard circuit={c} tool={tool} fit={frame} selection={selection} onSelect={select} updateGate={(i,p)=>{try{uc.updateGate(i,p);edited()}catch(e){setStatus(String(e))}}} onChange={edited}/></div>
            <div className="lab-signals">{lab.inputs.map(name=>{const g=c.gates.find(g=>g.item instanceof Button&&g.item.name===name)?.item;return <button key={name} disabled={!g} aria-pressed={!!g?.get('Y')} aria-label={`${id} input ${name}`} onClick={()=>toggle(name)}>{name} <b>{g?.get('Y')?1:0}</b></button>})}
                {lab.clock&&<button onClick={()=>tick()}>pulse clock</button>}
                <div className="lab-values">{lab.outputs.map(name=>{let v='—';try{v=String(Number(readOutput(c,name)))}catch{}return <output key={name}>{name} <b data-output={name}>{v}</b></output>})}</div>
            </div>
            {id==='byte'&&<div className="word-readout"><span>binary <b>{data.toString(2).padStart(8,'0')}</b></span><span>unsigned <b>{data}</b></span><span>signed <b>{data&128?data-256:data}</b></span><span>hex <b>{data.toString(16).padStart(2,'0')}</b></span></div>}
            {memory&&<div className="cpu-lab-panel"><div className="lab-actions"><label>program <select value={example} onChange={e=>{setExample(+e.target.value);cpuLoad(+e.target.value)}}>{programs.map((p,i)=><option key={i} value={i}>{p.name}</option>)}</select></label><button onClick={()=>cpuLoad(example)}>power cycle</button><button onClick={()=>tick(10)}>10 instructions</button><output>a={safeWord(c,'a',8)} pc={safeWord(c,'pc',6)} · {cycles} pulses</output></div><details><summary>inspect the 64 memory bytes</summary><div className="ram-grid">{Array.from(memory.bytes,(b,i)=><label key={i}>{i}<input aria-label={`cpu memory ${i}`} type="number" min={0} max={255} value={b} onChange={e=>{const n=+e.target.value;if(Number.isInteger(n)&&n>=0&&n<256){memory.bytes[i]=n;refresh();save()}}}/></label>)}</div></details></div>}
            <output className="lab-status" aria-live="polite">{status}</output>
            {selection&&<p className="pin-readout">{selection.gate.name||selection.gate.type}.{selection.pin} = {Number(!!selection.gate.get(selection.pin))} · highlighted wires belong to that signal. <button onClick={()=>select(null)}>clear trace</button></p>}
            <details className="lab-hint"><summary>hint & editor controls</summary><p>{lab.hint}</p><p>use interact to toggle inputs or drag gates; inspect to trace a pin; wire to drag connections; erase to remove real objects. scroll to zoom, drag empty space to pan. the check runs on a copy and does not consume your current state.</p></details><small className="storage-note">{storage||'edits save locally; no account required'}</small>
        </>}
    </section>
}
