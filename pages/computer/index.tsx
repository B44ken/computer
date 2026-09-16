import { useEffect, useRef, useState } from 'react'
import { CircuitBoard, Frame, Selection } from '../../components/CircuitBoard'
import { Toolbox, Tool } from '../../components/Toolbox'
import { Gate, Wire, ANDGate } from '../../components/gates'
import { useCircuit } from '../../hooks/useCircuit'
import { Circuit } from '../../lib/circuit'
import { buildComputer, Computer, powerOn, step, Variant, word } from '../../lib/computer'
import { assemble, disassemble, programs } from '../../lib/computer/programs'
import { validateComputer } from '../../lib/computer/validate'
import { serializeCircuit } from '../../lib/serialization'

const hex=(n:number)=>n.toString(16).padStart(2,'0')
export default function ComputerPage() {
    const {circuit,interact,setCircuit,updateGate,getCircuit}=useCircuit(()=>new Circuit(),false)
    const [computer,setComputer]=useState<Computer|null>(null),current=useRef<Computer|null>(null)
    const [tool,setTool]=useState<Tool>('Inspect'),[selection,setSelection]=useState<Selection|null>(null)
    const [frame,setFrame]=useState<Frame>(),[source,setSource]=useState(programs[0].source),[program,setProgram]=useState(0)
    const [status,setStatus]=useState('building the circuit…'),[running,setRunning]=useState(false),[busy,setBusy]=useState(true)
    const timer=useRef<ReturnType<typeof setInterval>|null>(null),clockLevel=useRef(false)
    const pause=()=>{if(timer.current)clearInterval(timer.current);timer.current=null;setRunning(false)}
    const fit=(cpu=current.current)=>{if(cpu)setFrame({x:0,y:0,width:cpu.layout.width,height:cpu.layout.height,key:Date.now()})}
    const refresh=()=>{try{interact()}catch(e){pause();setStatus(String(e))}}
    const active=()=>{const cpu=current.current;if(!cpu)throw Error('no computer');cpu.circuit=getCircuit();return cpu}
    const load=(text=source)=>{
        pause()
        try {const result=assemble(text),cpu=active();powerOn(cpu,result.image);clockLevel.current=false;refresh();setStatus(`${result.listing.length} bytes assembled; clock low, pc and accumulator zero.`)}
        catch(e){setStatus(String(e))}
    }
    const changeVariant=async(variant:Variant)=>{
        pause();setBusy(true);setStatus('placing gates and routing real wires…')
        await new Promise(resolve=>setTimeout(resolve,20))
        try {
            const cpu=buildComputer(variant),report=validateComputer(cpu)
            current.current=cpu;setComputer(cpu);setCircuit(cpu.circuit);powerOn(cpu,assemble(source).image);clockLevel.current=false
            setSelection(null);setTool('Inspect');fit(cpu);refresh()
            setStatus(`${report.pins} real pins checked: no opens, shorts, overlaps or wires through gates.`)
        }catch(e){setStatus(String(e))}finally{setBusy(false)}
    }
    const advance=(count=1)=>{
        try {
            const cpu=active(),before=word(cpu.pc)
            for(let i=0;i<count;i++)step(cpu)
            clockLevel.current=false;refresh();setStatus(`pc ${hex(before)} → ${hex(word(cpu.pc))}; accumulator ${hex(word(cpu.a))}`)
        }catch(e){pause();setStatus(String(e))}
    }
    const edit=()=>{
        pause()
        try {const cpu=active(),level=!!cpu.clock.get('Y');if(level&&!clockLevel.current)cpu.cycles++;clockLevel.current=level;refresh();setStatus('circuit edited; wires determine the connections. validate to check it.')}
        catch(e){setStatus(String(e))}
    }
    const run=()=>{
        if(timer.current){pause();return}
        setRunning(true)
        timer.current=setInterval(()=>{
            const cpu=active(),pc=word(cpu.pc),a=word(cpu.a),inst=cpu.memory.bytes[pc]
            advance()
            if(a===0&&inst>>6===3&&(inst&63)===pc){pause();setStatus('park loop reached. the viewer paused; there is no hardware halt.')}
        },180)
    }
    const focus=(group:string)=>{
        const nodes=current.current?.nodes.filter(n=>n.group===group||(group==='alu'&&n.group==='acc'))
        if(!nodes?.length)return
        const x=Math.min(...nodes.map(n=>n.x))-4,y=Math.min(...nodes.map(n=>n.y))-9
        setFrame({x,y,width:Math.max(...nodes.map(n=>n.x+n.w))-x+5,height:Math.max(...nodes.map(n=>n.y+n.h))-y+5,key:Date.now()})
    }
    const exportFile=()=>{
        const blob=new Blob([JSON.stringify(serializeCircuit(getCircuit()))],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a')
        a.href=url;a.download=`circuit-${computer?.variant}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    }
    useEffect(()=>{changeVariant('manual');return ()=>{if(timer.current)clearInterval(timer.current)}},[])
    useEffect(()=>{
        // Also useful from devtools: these are the editor's real objects.
        ;(window as any).nativeComputer={get computer(){return current.current},get circuit(){return getCircuit()},classes:{Circuit,Gate,Wire,ANDGate},
            advance,changeVariant,validate:()=>validateComputer(active()),loadProgram:(i:number)=>{setProgram(i);setSource(programs[i].source);load(programs[i].source)}}
    })
    const pc=computer?word(computer.pc):0,a=computer?word(computer.a):0,inst=computer?.memory.bytes[pc]||0
    const selectedNode=computer?.nodes.find(n=>n.gate===selection?.gate),signal=selection&&(selectedNode?.signals[selection.pin]||`${selection.gate.type}.${selection.pin}`)
    return <div className="computer-page">
        <header><div><h1>computer</h1><span>your gates · your wires · one instruction per rising edge</span></div><nav>
            <a href="/halfadder">half adder</a>
            <button disabled={busy} aria-pressed={computer?.variant==='manual'} onClick={()=>changeVariant('manual')}>hand-built</button>
            <button disabled={busy} aria-pressed={computer?.variant==='auto'} onClick={()=>changeVariant('auto')}>autorouted</button>
        </nav></header>
        <div className="workspace"><main>
            <Toolbox tool={tool} setTool={setTool}/>
            <div className="board-controls"><button onClick={()=>fit()}>fit</button><button onClick={()=>focus('alu')}>subtractor + accumulator</button><button onClick={()=>focus('pc')}>program counter</button><button onClick={()=>setSelection(null)}>clear trace</button>
                <small>{computer&&`${computer.layout.metrics.gates} logic gates · ${computer.layout.metrics.crossovers} crosses · ${computer.layout.width} × ${computer.layout.height}`}</small></div>
            <div className="board-area"><CircuitBoard {...{tool,circuit,selection}} fit={frame} updateGate={(id,p)=>{pause();try{updateGate(id,p);setStatus('gate moved; validate or rebuild before continuing.')}catch(e){setStatus(String(e))}}} onSelect={setSelection} onChange={edit}/></div>
            <output data-testid="status">{status}</output>
        </main><aside>
            <section><h2>machine</h2><div className="registers"><label>a<strong data-testid="a">{hex(a)}</strong></label><label>pc<strong data-testid="pc">{hex(pc)}</strong></label><label>edges<strong data-testid="cycles">{computer?.cycles||0}</strong></label></div>
                <div className="buttons"><button disabled={busy} onClick={()=>{pause();advance()}}>step</button><button disabled={busy} onClick={()=>{pause();advance(10)}}>+10</button><button disabled={busy} onClick={run}>{running?'pause':'run'}</button></div>
                <p><code>{inst.toString(2).padStart(8,'0').slice(0,2)} | {inst.toString(2).padStart(8,'0').slice(2)}</code><br/><b>{disassemble(inst)}</b></p>
            </section>
            <section><h2>program</h2><select aria-label="program" value={program} onChange={e=>{const i=+e.target.value;setProgram(i);setSource(programs[i].source);load(programs[i].source)}}>{programs.map((p,i)=><option key={i} value={i}>{p.name}</option>)}</select>
                <textarea aria-label="assembly" spellCheck={false} value={source} onChange={e=>setSource(e.target.value)}/><button disabled={busy} onClick={()=>load()}>assemble + power cycle</button>
            </section>
            <section><h2>memory · shared code and data</h2><div className="memory">{Array.from(computer?.memory.bytes||new Uint8Array(64),(b,i)=><button key={i} data-address={i} className={`${i===pc?'current ':''}${computer?.memory.lastWrite===i?'written':''}`} title={`0x${hex(i)}: ${disassemble(b)}`} onDoubleClick={()=>{
                pause();const text=prompt(`memory[${hex(i)}] (hex byte)`,hex(b));if(text===null)return
                if(!/^[\da-f]{1,2}$/i.test(text.trim())){setStatus('enter a hex byte, 00–ff.');return}
                active().memory.bytes[i]=parseInt(text,16);refresh()
            }}><small>{hex(i)}</small>{hex(b)}</button>)}</div><p className="hint">double-click a byte to edit. green marks the next instruction; the outline marks the last write.</p></section>
            <section><h2>inspect</h2><p className="signal">{selection?`${signal} = ${selection.gate.get(selection.pin)?1:0}`:'click a gate pin or wire. scroll to zoom; drag the background to pan.'}</p>
                {selection&&<div className="pins">{Object.entries(selection.gate.pins).map(([pin,p])=><button key={pin} onClick={()=>setSelection({gate:selection.gate,pin})}>{pin.toLowerCase()} {p.voltage?1:0}</button>)}</div>}
                <p className="hint">{computer?.variant==='manual'?`${computer.layout.metrics.manualConnections} local connections are hand-routed. the bit slices and carry chain are fixed by hand; shared buses are autorouted.`:'automatic gate placement and shared-trunk routing. crossings are real Cross gates, not decorative bridges.'}</p>
                <button onClick={()=>{pause();try{const r=validateComputer(active());setStatus(`${r.pins} pins: all connections correct; no opens, shorts or overlaps.`)}catch(e){setStatus(String(e))}}}>validate actual circuit</button> <button onClick={exportFile}>export Circuit json</button>
            </section>
        </aside></div>
        <style>{`
            .computer-page{position:fixed;inset:0;background:#fff;color:#333;font:13px system-ui,sans-serif;display:flex;flex-direction:column}
            .computer-page *{box-sizing:border-box}.computer-page button,.computer-page select,.computer-page textarea{font:inherit;color:inherit;background:#fff;border:1px solid #ddd;border-radius:3px;padding:5px 8px}.computer-page button{cursor:pointer}.computer-page button:hover{background:#f2f2f2}.computer-page button[aria-pressed=true]{border-color:#777;font-weight:650;background:#efefef}.computer-page button:disabled{opacity:.5}
            .computer-page header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #ddd;gap:12px}.computer-page h1{font-size:20px;margin:0}.computer-page header span{font-size:12px;color:#888}.computer-page nav{display:flex;gap:8px;align-items:center}.computer-page nav a{color:#777;font-size:12px;margin-right:10px}
            .computer-page .workspace{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 300px}.computer-page main{display:flex;flex-direction:column;min-width:0;min-height:0}.computer-page [data-testid=toolbox]{display:flex;flex-wrap:wrap;gap:3px;padding:8px;border-bottom:1px solid #eee;justify-content:flex-start}.computer-page [data-testid=toolbox] button{padding:4px 7px;font-size:11px;border-radius:0;min-width:42px;width:auto;margin:0}
            .computer-page .board-controls{display:flex;gap:5px;align-items:center;padding:7px 10px;border-bottom:1px solid #eee;font-size:11px;flex-wrap:wrap}.computer-page .board-controls small{margin-left:auto;color:#999}.computer-page .board-area{flex:1;min-height:0}.computer-page output{padding:9px 12px;min-height:36px;border-top:1px solid #ddd;font-size:11px;color:#666}
            .computer-page aside{border-left:1px solid #ddd;overflow-y:auto;padding:15px}.computer-page section{margin-bottom:19px}.computer-page h2{font-size:11px;font-weight:600;letter-spacing:.8px;color:#999;margin:0 0 8px}.computer-page .registers{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}.computer-page .registers label{font-size:11px;color:#777;border-bottom:1px solid #ddd}.computer-page .registers strong{display:block;color:#333;font:25px ui-monospace,monospace;padding:4px 0}.computer-page .buttons{display:flex;gap:5px}.computer-page p{line-height:1.6;margin:9px 0}.computer-page code{font-family:ui-monospace,monospace}.computer-page select,.computer-page textarea{width:100%;margin-bottom:6px}.computer-page textarea{height:170px;font:11px/1.5 ui-monospace,monospace;resize:vertical;padding:8px}.computer-page .memory{display:grid;grid-template-columns:repeat(8,1fr);gap:2px}.computer-page .memory button{font:12px ui-monospace,monospace;padding:4px 0;border-radius:1px}.computer-page .memory small{display:block;font-size:8px;color:#999;margin-bottom:2px}.computer-page .memory .current{background:#e0f4e3;border-color:#8caa92}.computer-page .memory .written{box-shadow:inset 0 0 0 1px #9c7abe}.computer-page .hint{font-size:11px;color:#999}.computer-page .signal{overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace;color:#8653ac}.computer-page .pins{display:flex;flex-wrap:wrap;gap:4px;font:11px ui-monospace,monospace}
            @media(max-width:800px){.computer-page .workspace{grid-template-columns:minmax(0,1fr) 250px}.computer-page .board-controls small{display:none}.computer-page nav a{display:none}}
        `}</style>
    </div>
}
