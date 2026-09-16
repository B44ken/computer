import * as React from 'react'
import { CircuitBoard } from '../../components/CircuitBoard'
import { Toolbox, Tool } from '../../components/Toolbox'
import { Gate } from '../../components/gates/core/Gate'
import { Wire } from '../../components/gates/core/Wire'
import { NativeComputer, Variant, buildComputer, clockCycle, readWord, restartComputer, traceWires, validateNative } from '../../lib/computer/build'
import { assemble, programs, disassemble } from '../../lib/computer/programs'

const hex=(n:number)=>n.toString(16).padStart(2,'0')
type State={variant:Variant,source:string,program:number,tool:Tool,cycles:number,tick:number,fitKey:number,error:string,status:string,selected?:Gate|Wire,pin?:string,running:boolean}
export default class ComputerPage extends React.Component<{},State> {
    state:State={variant:'manual',source:programs[0].source,program:0,tool:'Interact',cycles:0,tick:0,fitKey:0,error:'',status:'building native circuit…',running:false}
    computer:NativeComputer|undefined
    board={current:null as CircuitBoard|null}
    timer:ReturnType<typeof setInterval>|undefined
    componentDidMount(){this.build('manual');(window as any).nativeComputer=this}
    componentWillUnmount(){clearInterval(this.timer);delete (window as any).nativeComputer}
    pause=()=>{clearInterval(this.timer);this.timer=undefined;if(this.state.running)this.setState({running:false})}
    action=(f:()=>void)=>{
        try{f();this.setState(s=>({tick:s.tick+1,error:''}))}
        catch(e){this.pause();this.setState({error:(e as Error).message})}
    }
    build=(variant:Variant)=>{
        this.pause();this.action(()=>{
            const image=assemble(this.state.source).image
            this.computer=buildComputer(variant,image)
            this.setState(s=>({variant,cycles:0,fitKey:s.fitKey+1,selected:undefined,pin:undefined,
                status:`${this.computer!.validation.pins} native pins checked · no opens, shorts, or overlapping gates`}))
        })
    }
    choose=(variant:Variant)=>{
        this.setState({status:'placing and wiring native gates…'})
        requestAnimationFrame(()=>requestAnimationFrame(()=>this.build(variant)))
    }
    load=()=>{this.pause();this.action(()=>{
        const assembled=assemble(this.state.source)
        if(!this.computer)return
        restartComputer(this.computer,assembled.image)
        this.setState({cycles:0,status:`${assembled.listing.length} bytes loaded · fourteen dffs initialized to zero`})
    })}
    step=(count=1)=>this.action(()=>{
        if(!this.computer)return
        const c=this.computer
        let parked=false
        for(let i=0;i<count;i++){
            const pc=readWord(c.byName,'pc',6),a=readWord(c.byName,'a',8),inst=c.memory.word('I',8)
            clockCycle(c)
            parked=inst>>6===3&&a===0&&readWord(c.byName,'pc',6)===pc
        }
        this.setState({cycles:c.memory.cycles,status:parked?'jz self-loop · the viewer paused; the hardware has no halt instruction':`clock low · memory writes: ${c.memory.writes}`})
        if(parked)this.pause()
    })
    run=()=>{
        if(this.timer){this.pause();return}
        this.setState({running:true});this.timer=setInterval(()=>this.step(),200)
    }
    changed=()=>{this.pause();this.action(()=>{this.computer?.circuit.update();this.setState({cycles:this.computer?.memory.cycles||0,status:'edited circuit simulated from its wires'})})}
    validate=()=>this.action(()=>{
        const c=this.computer!;validateNative(c.circuit,c.pins,c.byName)
        this.setState({status:'all native pin connections match; zero opens, shorts, or overlapping gates'})
    })
    export=()=>{
        if(!this.computer)return
        const c=this.computer.circuit
        const json={schema:'native-circuit/v1',gates:c.gates.map(g=>({type:(g.item.constructor as any).type,name:g.item.name,coords:[g.coords.x,g.coords.y],size:[g.item.size.x,g.item.size.y],pins:Object.fromEntries(Object.entries(g.item.pins).map(([n,p])=>[n,{...p,coord:[p.coord.x,p.coord.y]}]))})),wires:c.wires.map(w=>w.item.path.map(p=>[p.x,p.y])),memory:[...this.computer.memory.bytes]}
        const url=URL.createObjectURL(new Blob([JSON.stringify(json)],{type:'application/json'})),a=document.createElement('a')
        a.href=url;a.download=`native-${this.state.variant}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    }
    render() {
        const {computer:c}=this,s=this.state,a=c?readWord(c.byName,'a',8):0,pc=c?readWord(c.byName,'pc',6):0
        const inst=c?.memory.word('I',8)||0,highlight=c&&s.selected&&c.circuit.connections?traceWires(c.circuit,s.selected,s.pin):undefined
        return <div className="native-computer">
            <style>{`
.native-computer{position:fixed;inset:0;color:#222c25;background:#f5f7f4;font:13px system-ui,sans-serif;display:flex;flex-direction:column}
.native-computer *{box-sizing:border-box}.native-computer button,.native-computer select,.native-computer textarea{font:inherit}
.native-computer button,.native-computer select{background:#fff;color:inherit;border:1px solid #c5cec6;border-radius:3px;padding:5px 8px;cursor:pointer}
.native-computer button:hover{background:#e9efe9}.native-computer button.active{background:#233c2b;color:#fff}.native-computer header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:#fff;border-bottom:1px solid #ccd4cc;gap:14px}
.native-computer h1{font-size:20px;letter-spacing:-.5px;margin:0}.native-computer small{color:#68786b}.native-computer header small{display:block;margin-top:4px}
.native-computer .native-shell{display:grid;grid-template-columns:minmax(0,1fr) 310px;flex:1;min-height:0}.native-computer main{display:flex;flex-direction:column;min-width:0;min-height:0}.native-computer .tools{padding:7px 10px;border-bottom:1px solid #ccd4cc;font-size:11px;background:#fff}.native-computer .view-tools{display:flex;gap:5px;align-items:center;padding:8px 10px;font-size:11px}.native-computer .view-tools small{margin-left:auto}
.native-computer .canvas{flex:1;min-height:0}.native-computer .status{font-size:12px;padding:9px 12px;border-top:1px solid #ccd4cc;background:white;min-height:35px}.native-computer .error{color:#a52236}
.native-computer aside{background:#fff;border-left:1px solid #ccd4cc;padding:17px;overflow:auto}.native-computer h2{font-size:11px;letter-spacing:1.5px;font-weight:600;text-transform:uppercase;margin:0 0 8px;color:#536b59}.native-computer section{margin-bottom:22px}.native-computer .registers{display:flex;gap:6px;margin-bottom:12px}.native-computer .registers div{flex:1;background:#edf2ec;border-radius:3px;padding:9px}.native-computer .registers b{font:24px monospace;display:block;margin-top:3px}.native-computer .row{display:flex;gap:5px;flex-wrap:wrap}
.native-computer .hint{font-size:12px;color:#5f7063;line-height:1.6;margin:8px 0}.native-computer textarea{width:100%;height:170px;font:12px/1.5 monospace!important;background:#f9faf8;border:1px solid #d0d9d0;padding:9px;resize:vertical}.native-computer select{width:100%;margin-bottom:7px}.native-computer .load{width:100%;margin-top:6px}.native-computer .memory{display:grid;grid-template-columns:repeat(8,1fr);gap:3px}.native-computer .memory button{font:12px monospace;padding:3px 0}.native-computer .memory small{display:block;font-size:8px;opacity:.75}.native-computer .memory .pc{background:#dceadd;border-color:#7aa782}.native-computer .memory .write{box-shadow:inset 0 0 0 1px #a56fc4}.native-computer pre{font:11px/1.6 monospace;white-space:pre-wrap;overflow-wrap:anywhere}.native-computer code{font:12px monospace}
@media(max-width:800px){.native-computer .native-shell{grid-template-columns:minmax(0,1fr) 255px}.native-computer aside{padding:12px}.native-computer .view-tools small{display:none}}@media(max-width:580px){.native-computer{position:static;min-height:100vh}.native-computer .native-shell{display:block}.native-computer main{height:70vh}.native-computer header{align-items:flex-start;flex-direction:column}.native-computer aside{border-top:1px solid #ccd4cc}}
`}</style>
            <header><div><h1>computer / native circuit</h1><small>verilog/stupid.v · 88 primitive gates · your simulator</small></div><div className="row">
                <button id="manual" className={s.variant==='manual'?'active':''} onClick={()=>this.choose('manual')}>teaching layout</button>
                <button id="auto" className={s.variant==='auto'?'active':''} onClick={()=>this.choose('auto')}>automatic layout</button>
            </div></header>
            <div className="native-shell"><main><div className="tools"><Toolbox tool={s.tool} setTool={value=>this.setState(prev=>({tool:typeof value==='function'?(value as (v:Tool)=>Tool)(prev.tool):value}))}/></div>
                <div className="view-tools"><button onClick={()=>this.board.current?.fit()}>fit</button><button onClick={()=>this.board.current?.zoom(.7)}>+</button><button onClick={()=>this.board.current?.zoom(1/.7)}>−</button>
                    <button id="focus-sub" onClick={()=>this.board.current?.focus(c!.recipe.cells.filter(n=>n.group==='alu'||n.group==='acc').map(n=>c!.byName.get(n.id)!))}>subtractor</button>
                    <button onClick={()=>this.board.current?.focus(c!.recipe.cells.filter(n=>n.group==='pc').map(n=>c!.byName.get(n.id)!))}>pc</button>
                    <button onClick={()=>this.setState({selected:undefined,pin:undefined})}>clear trace</button>
                    <small>{c?`${c.metrics.gates} gates · ${c.metrics.crossovers} crosses · ${c.metrics.wires} wires`:''}</small></div>
                <div className="canvas">{c&&<CircuitBoard ref={el=>{this.board.current=el}} circuit={c.circuit} tool={s.tool} fitKey={s.fitKey} showNames={s.variant==='manual'}
                    annotations={c.groups} selected={s.selected} highlight={highlight} onSelect={(selected,pin)=>this.setState({selected,pin})}
                    updateGate={(i,pos)=>{c.circuit.gates[i].coords=pos;c.circuit.invalidate();this.setState(p=>({tick:p.tick+1}))}}
                    onChange={this.changed}/>}</div>
                <div className={'status '+(s.error?'error':'')} id="status">{s.error||s.status}</div>
            </main><aside>
                <section><h2>clock + state</h2><div className="registers"><div><small>a</small><b id="reg-a">{hex(a)}</b></div><div><small>pc</small><b id="reg-pc">{hex(pc)}</b></div><div><small>cycles</small><b id="cycles">{s.cycles}</b></div></div>
                    <div className="row"><button id="step" onClick={()=>{this.pause();this.step()}}>step clock</button><button id="step10" onClick={()=>{this.pause();this.step(10)}}>+10</button><button id="run" onClick={this.run}>{s.running?'pause':'run'}</button></div>
                    <p className="hint"><code>{inst.toString(2).padStart(8,'0').slice(0,2)} | {inst.toString(2).padStart(8,'0').slice(2)}</code><br/>{disassemble(inst)} · memory operand {hex(c?.memory.word('R',8)||0)}</p>
                </section>
                <section><h2>program</h2><select id="program" value={s.program} onChange={e=>this.setState({program:+e.target.value,source:programs[+e.target.value].source},this.load)}>
                    {programs.map((p,i)=><option value={i} key={i}>{p.name}</option>)}</select>
                    <textarea id="source" value={s.source} spellCheck={false} onChange={e=>this.setState({source:e.target.value})}/>
                    <button id="load" className="load" onClick={this.load}>assemble + restart</button>
                </section>
                <section><h2>shared memory / 64 bytes</h2><div className="memory">{c&&Array.from(c.memory.bytes,(b,i)=><button key={i} data-address={i} className={(i===pc?'pc ':'')+(i===c.memory.lastWrite?'write':'')} onDoubleClick={()=>{
                        this.pause();const value=prompt(`memory[${hex(i)}] · hex byte`,hex(b));if(value===null)return
                        this.action(()=>{if(!/^[0-9a-f]{1,2}$/i.test(value.trim()))throw Error('enter a hex byte: 00–ff');c.memory.bytes[i]=parseInt(value,16);c.circuit.update()})
                    }}><small>{hex(i)}</small>{hex(b)}</button>)}</div><p className="hint">double-click a byte to edit. green = pc; purple outline = last write.</p></section>
                <section><h2>inspect + edit</h2>{s.selected instanceof Gate?<pre>{s.selected.name || (s.selected.constructor as any).type}{'\n'}{Object.entries(s.selected.pins).map(([name,p])=>`${name}: ${p.voltage?1:0}`).join(' · ')}</pre>:<p className="hint">click a gate, pin, or wire to trace its signal.</p>}
                    <p className="hint">drag gates with interact. erase removes real connections. wire joins two snapped points. the cpu is built directly on the same board.</p>
                    <div className="row"><button id="validate" onClick={this.validate}>check wiring</button><button id="export" onClick={this.export}>export circuit</button></div>
                    <p className="hint">one row is one bit. follow invert → xor → carry → load mux → hold mux → dff. the lower bank increments the pc or selects the jump address.</p>
                </section>
            </aside></div>
        </div>
    }
}
