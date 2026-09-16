import * as React from 'react'
import { Circuit } from '../lib/circuit'
import { Wire } from './gates/core/Wire'
import { Gate } from './gates/core/Gate'
import { Coord, coord } from '../lib/coord'
import { Tool } from './Toolbox'

type SVGWireProps = { wire:Wire, scale:number, origin:Coord, selected?:boolean, dim?:boolean, onMouseDown?:(e:React.MouseEvent)=>void }
type SVGGateProps = { gate:Gate, coords:Coord, scale:number, origin:Coord, showName?:boolean, selected?:boolean,
    onMouseUp?:()=>void, onMouseDown?:(e:React.MouseEvent)=>void }

export class SVGGate extends React.Component<SVGGateProps, {hover:boolean}> {
    state={hover:false}
    render() {
        const {gate,coords,scale,origin,onMouseUp,onMouseDown,showName=true,selected}=this.props
        const p=coords.sub(origin)
        return <g data-gate={gate.name || (gate.constructor as any).type} transform={`translate(${p.x*scale},${p.y*scale})`}
            onMouseEnter={()=>this.setState({hover:true})} onMouseLeave={()=>this.setState({hover:false})}
            onMouseUp={onMouseUp} onMouseDown={onMouseDown}>
            <title>{gate.name || (gate.constructor as any).type}</title>
            {selected && <rect x={-.3*scale} y={-.3*scale} width={(gate.size.x+.6)*scale} height={(gate.size.y+.6)*scale} fill="none" stroke="#825bbd" strokeWidth={.1*scale}/>}
            <gate.view gate={gate} width={gate.size.x*scale} height={gate.size.y*scale} hover={this.state.hover}/>
            {showName && gate.name && <text x={0} y={-scale*.15} fontSize={scale*.5} fill="#666">{gate.name}</text>}
        </g>
    }
}
export const SVGWire = ({wire,scale,origin,onMouseDown,selected,dim}:SVGWireProps) => {
    const points=wire.path.map(c=>c.sub(origin)).map(c=>`${c.x},${c.y}`).join(' ')
    return <g transform={`scale(${scale})`} opacity={dim?.12:1}>
        <polyline points={points} fill="none" stroke="transparent" strokeWidth={.7} onMouseDown={onMouseDown}/>
        <polyline points={points} fill="none" stroke={selected?'#825bbd':wire.voltage?'#53a95b':'#999'} strokeWidth={selected?.24:.12} pointerEvents="none"/>
    </g>
}

type BoardProps = {tool:Tool,circuit:Circuit,updateGate:(id:number,coords:Coord)=>void,scale?:number,
    fitKey?:number,showNames?:boolean,onChange?:()=>void,onSelect?:(item:Gate|Wire,pin?:string)=>void,
    selected?:Gate|Wire,highlight?:Set<Wire>,annotations?:{title:string,x:number,y:number,w:number,h:number}[]}
type BoardState={view:number[],sketch:Coord[],mouse:Coord}
export class CircuitBoard extends React.Component<BoardProps,BoardState> {
    state:BoardState={view:[0,0,30,20],sketch:[],mouse:coord([0,0])}
    svg={current:null as SVGSVGElement|null}
    private drag:{gate?:number,start:Coord,at:Coord,view:number[],moved:boolean}|null=null
    componentDidMount(){this.fit()}
    componentDidUpdate(prev:BoardProps){if(prev.fitKey!==this.props.fitKey)this.fit()}
    fit=()=>{
        const points=this.props.circuit.gates.flatMap(g=>[g.coords,g.coords.add(g.item.size)]).concat(this.props.circuit.wires.flatMap(w=>w.item.path))
        if(!points.length){const r=this.svg.current?.getBoundingClientRect();this.setState({view:[0,0,(r?.width||960)/(this.props.scale||48),(r?.height||640)/(this.props.scale||48)]});return}
        const x=Math.min(...points.map(p=>p.x))-5,y=Math.min(...points.map(p=>p.y))-5
        this.setState({view:[x,y,Math.max(...points.map(p=>p.x))-x+5,Math.max(...points.map(p=>p.y))-y+5]})
    }
    focus=(gates:Gate[])=>{
        const gs=this.props.circuit.gates.filter(g=>gates.includes(g.item));if(!gs.length)return
        const x=Math.min(...gs.map(g=>g.coords.x))-5,y=Math.min(...gs.map(g=>g.coords.y))-8
        this.setState({view:[x,y,Math.max(...gs.map(g=>g.coords.x+g.item.size.x))-x+4,Math.max(...gs.map(g=>g.coords.y+g.item.size.y))-y+4]})
    }
    zoom=(factor:number,point?:Coord)=>{
        const [x,y,w,h]=this.state.view,p=point||coord([x+w/2,y+h/2])
        if(w*factor<4||w*factor>2000)return
        this.setState({view:[p.x+(x-p.x)*factor,p.y+(y-p.y)*factor,w*factor,h*factor]})
    }
    private point=(e:{clientX:number,clientY:number})=>{
        const svg=this.svg.current!,p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY
        const q=p.matrixTransform(svg.getScreenCTM()!.inverse());return coord([q.x,q.y])
    }
    private change=()=>this.props.onChange?.()
    private down=(e:React.MouseEvent,gate?:number,wire?:number)=>{
        if(e.button!==0)return
        e.stopPropagation();const p=this.point(e),{tool,circuit}=this.props
        const pin=(e.target as Element).closest('[data-pin]')?.getAttribute('data-pin')||undefined
        if(gate!==undefined)this.props.onSelect?.(circuit.gates[gate].item,pin)
        if(wire!==undefined)this.props.onSelect?.(circuit.wires[wire].item)
        if(tool==='Erase') {
            if(gate!==undefined)circuit.remove(gate,circuit.gates[gate].item)
            if(wire!==undefined)circuit.remove(wire,circuit.wires[wire].item)
            this.change();return
        }
        if(typeof tool==='function') {
            circuit.add(new tool(),p.snap(.5));this.change();return
        }
        if(tool==='Wire') {
            const q=p.snap(.5),s=this.state.sketch
            if(!s.length)this.setState({sketch:[q],mouse:q})
            else {const last=s[s.length-1],bend=coord([q.x,last.y]);circuit.add(new Wire([...s,bend,q]));this.setState({sketch:[]});this.change()}
            return
        }
        if(wire!==undefined)return
        this.drag={gate,start:p,at:gate!==undefined?circuit.gates[gate].coords:p,view:[...this.state.view],moved:false}

    }
    private move=(e:React.MouseEvent)=>{
        const p=this.point(e)
        if(this.state.sketch.length)this.setState({mouse:p.snap(.5)})
        if(!this.drag)return
        const d=this.drag,delta=p.sub(d.start)
        if(delta.len()>.15)d.moved=true
        if(d.gate!==undefined) {
            const pos=d.at.add(delta).snap(.5)
            if(!this.props.circuit.gates[d.gate].coords.eq(pos)) {
                this.props.circuit.invalidate();this.props.updateGate(d.gate,pos)
            }
        } else {const [x,y,w,h]=this.state.view;this.setState({view:[x-delta.x,y-delta.y,w,h]})}
    }
    private up=()=>{
        const d=this.drag;this.drag=null
        if(d?.gate!==undefined){if(!d.moved)this.props.circuit.gates[d.gate].item.click();this.change()}
    }
    render() {
        const {circuit,showNames=true,selected,highlight,annotations=[]}=this.props,{view,sketch,mouse}=this.state
        const origin=coord([0,0]),scale=1
        return <svg ref={el=>{this.svg.current=el}} className="border-2 w-full h-7/8" data-native-board="true"
            style={{width:'100%',height:'100%',minHeight:0,background:'#fafbf9',touchAction:'none'}}
            viewBox={view.join(' ')} onMouseDown={e=>this.down(e)} onMouseMove={this.move} onMouseUp={this.up}
            onMouseLeave={()=>this.drag=null} onWheel={e=>{e.preventDefault();this.zoom(e.deltaY>0?1.12:1/1.12,this.point(e))}}
            onDoubleClick={()=>{if(sketch.length)this.setState({sketch:[]})}}>
            <defs><pattern id="native-grid" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx={.5} cy={.5} r={.025} fill="#c5c9c6"/></pattern></defs>
            <rect x={view[0]} y={view[1]} width={view[2]} height={view[3]} fill="url(#native-grid)"/>
            {annotations.map((a,i)=><g key={i} pointerEvents="none"><rect x={a.x} y={a.y} width={a.w} height={a.h} fill="#dde6df" opacity={.35}/><text x={a.x} y={a.y-1} fontSize={.9} fill="#476052">{a.title}</text></g>)}
            {circuit.wires.map((w,i)=><g key={i} data-wire-index={i}><SVGWire wire={w.item} {...{scale,origin}} selected={highlight?.has(w.item)||selected===w.item} dim={!!highlight?.size&&!highlight.has(w.item)} onMouseDown={e=>this.down(e,undefined,i)}/></g>)}
            {circuit.gates.map((g,i)=><SVGGate key={i} gate={g.item} coords={g.coords} {...{scale,origin}}
                selected={selected===g.item} showName={showNames} onMouseDown={e=>this.down(e,i)}/>)}
            {sketch.length>0&&<SVGWire wire={new Wire([...sketch,coord([mouse.x,sketch[sketch.length-1].y]),mouse])} {...{scale,origin}}/>}
        </svg>
    }
}
