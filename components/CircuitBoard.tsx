import { useEffect, useRef, useState } from 'react'
import { Circuit } from '../lib/circuit'
import { Wire } from './gates/core/Wire'
import { Gate } from './gates/core/Gate'
import { Coord, coord } from '../lib/coord'
import { Tool } from './Toolbox'

export type Selection = { gate: Gate, pin: string }
export type Frame = { x: number, y: number, width: number, height: number, key?: number }
type SVGWireProps = { wire: Wire, scale: number, origin: Coord, selected?: boolean, dim?: boolean, onMouseDown?: (e: any) => void }
type SVGGateProps = { gate: Gate, coords: Coord, scale: number, origin: Coord, selected?: boolean, onMouseUp?: (e: any) => void, onMouseDown?: (e: any) => void }

export const SVGGate = ({ gate, coords, scale, origin, selected, onMouseUp, onMouseDown }: SVGGateProps) => {
    const [hover, setHover] = useState(false)
    coords = coords.sub(origin)
    const cx = gate.size.x * scale / 2, cy = gate.size.y * scale / 2
    return <g data-gate-type={gate.type} data-gate-name={gate.name} transform={`translate(${coords.x * scale}, ${coords.y * scale})`}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onMouseUp={onMouseUp} onMouseDown={onMouseDown}>
        <title>{gate.name || gate.type}</title>
        <g transform={`translate(${cx},${cy}) rotate(${gate.rotation}) scale(${gate.transformScale}) translate(${-cx},${-cy})`}>
            {selected && <rect x={-scale*.25} y={-scale*.25} width={(gate.size.x+.5)*scale} height={(gate.size.y+.5)*scale} rx={scale*.2} fill="#f0e8ff" stroke="#9b77c8" strokeWidth={scale*.07} />}
            <gate.view gate={gate} width={gate.size.x * scale} height={gate.size.y * scale} hover={hover} />
        </g>
        {gate.name && gate.type !== 'Memory' && <text x={0} y={-scale * 0.25} fontSize={scale * 0.75} fill="#666">{gate.name}</text>}
    </g>
}

export const SVGWire = ({ wire, scale, origin, selected, dim, onMouseDown }: SVGWireProps) => {
    const points = wire.path.map(c => c.sub(origin)).map(c => `${c.x},${c.y}`).join(' ')
    return <g transform={`scale(${scale})`} opacity={dim ? .14 : 1}>
        <polyline data-wire="true" points={points} fill="none" stroke={selected ? '#9861cb' : wire.voltage ? '#58a76b' : '#aaa'} strokeWidth={selected ? .22 : .11} onMouseDown={onMouseDown}>
            <title>{wire.voltage ? '1' : '0'}</title>
        </polyline>
    </g>
}

export const CircuitBoard = ({ tool, circuit, updateGate, scale = 48, fit, selection, onSelect, onChange }: {
    tool: Tool, circuit: Circuit, updateGate: (id: number, coords: Coord) => void, scale?: number,
    fit?: Frame, selection?: Selection | null, onSelect?: (s: Selection | null) => void, onChange?: () => void
}) => {
    const ref = useRef<SVGSVGElement>(null)
    const [view, setView] = useState({ origin: coord([0, 0]), scale })
    const [drag, setDrag] = useState<{ i?: number, start: Coord, offset?: Coord, pan?: boolean, preview?: Coord, screen: [number,number] } | null>(null)
    const [sketch, setSketch] = useState<Coord[]>([])
    useEffect(() => {
        if (!fit || !ref.current) return
        const frame = () => {
            const { width, height } = ref.current!.getBoundingClientRect()
            if (!width || !height) return
            const s = Math.min(width / fit.width, height / fit.height)
            setView({ scale: s, origin: coord([fit.x - (width/s-fit.width)/2, fit.y-(height/s-fit.height)/2]) })
        }
        frame()
        const observer = new ResizeObserver(frame); observer.observe(ref.current)
        return () => observer.disconnect()
    }, [fit])
    useEffect(() => {
        const svg = ref.current!
        const wheel = (e: WheelEvent) => {
            e.preventDefault()
            const box = svg.getBoundingClientRect(), local = coord([e.clientX-box.left,e.clientY-box.top])
            setView(v => {
                const s = Math.max(.8,Math.min(120,v.scale*(e.deltaY>0?.86:1/.86)))
                return {scale:s,origin:v.origin.add(local.div(v.scale)).sub(local.div(s))}
            })
        }
        svg.addEventListener('wheel',wheel,{passive:false})
        return () => svg.removeEventListener('wheel',wheel)
    }, [])
    const point = (e: { clientX: number, clientY: number }) => {
        const box = ref.current!.getBoundingClientRect()
        return coord([(e.clientX-box.left)/view.scale, (e.clientY-box.top)/view.scale]).add(view.origin)
    }
    const snap = (p: Coord) => {
        for (const {item,coords} of circuit.gates) for (const pin in item.pins) {
            const q = item.pinPosition(pin, coords)
            if (q.sub(p).len() < .3) return q
        }
        return p.round()
    }
    const selectGate = (gate: Gate, e: any) => {
        const pin = (e.target as Element).closest('[data-pin]')?.getAttribute('data-pin') || Object.keys(gate.pins).find(p=>gate.pins[p].type==='out') || Object.keys(gate.pins)[0]
        onSelect?.({ gate, pin })
    }
    const gateMouseDown = (g: {item: Gate,coords: Coord}, i: number, e: any) => {
        if (tool === 'Wire' || typeof tool === 'function') return
        e.stopPropagation()
        if (tool === 'Inspect') selectGate(g.item, e)
        else if (tool === 'Erase') { circuit.remove(i, g.item); onChange?.() }
        else setDrag({i,start:g.coords,offset:point(e).sub(g.coords),screen:[e.clientX,e.clientY]})
    }
    const mouseDown = (e: any) => {
        const p = snap(point(e))
        if (typeof tool === 'function') { circuit.add(new tool(),p); onChange?.(); return }
        if (tool === 'Wire') setSketch([p,p])
        else if (tool === 'Interact' || tool === 'Inspect') setDrag({start:point(e),pan:true,screen:[e.clientX,e.clientY]})
    }
    const mouseMove = (e: any) => {
        const p = point(e)
        if (drag?.pan) setView(v=>({...v,origin:v.origin.add(drag.start.sub(p))}))
        else if (drag && drag.i !== undefined) setDrag({...drag,preview:p.sub(drag.offset!).round()})
        else if (sketch.length) {const end=snap(p);setSketch([sketch[0],coord([end.x,sketch[0].y]),end])}
    }
    const mouseUp = (e: any) => {
        if (sketch.length && sketch[0].sub(sketch.at(-1)!).len() > 1e-6) {circuit.add(new Wire(sketch));onChange?.()}
        if (drag && drag.i !== undefined) {
            const gate = circuit.gates[drag.i]?.item
            if (gate && Math.hypot(e.clientX-drag.screen[0],e.clientY-drag.screen[1]) < 4) {gate.click();onChange?.()}
            else if (drag.preview) updateGate(drag.i, drag.preview)
        }
        setSketch([]);setDrag(null)
    }
    const highlighted = selection ? circuit.trace(selection.gate,selection.pin) : null
    const dots = {backgroundImage:'radial-gradient(#ececec 1px, #fff 1px)',backgroundSize:`${view.scale}px ${view.scale}px`,backgroundPosition:`${-view.origin.x*view.scale}px ${-view.origin.y*view.scale}px`}
    return <svg ref={ref} data-testid="circuit-board" className="border-2 w-full h-7/8" style={{...dots,width:'100%',height:'100%',display:'block',touchAction:'none'}}
        onMouseMove={mouseMove} onMouseUp={mouseUp} onMouseDown={mouseDown} onMouseLeave={()=>{setSketch([]);setDrag(null)}}>
        {circuit.annotations.map((a,i)=><g key={i} pointerEvents="none">
            {a.width && a.height && <rect x={(a.x-view.origin.x)*view.scale} y={(a.y+1-view.origin.y)*view.scale} width={a.width*view.scale} height={a.height*view.scale} rx={view.scale*.4} fill="none" stroke="#e0e0e0" strokeWidth={view.scale*.08}/>}
            <text x={(a.x-view.origin.x)*view.scale} y={(a.y-view.origin.y)*view.scale} fontSize={view.scale*1.15} fill="#777">{a.text}</text>
        </g>)}
        {circuit.wires.map((w,i)=><SVGWire key={i} wire={w.item} scale={view.scale} origin={view.origin} selected={highlighted?.has(w.item)} dim={!!highlighted&&!highlighted.has(w.item)}
            onMouseDown={e=>{if(tool==='Erase'){e.stopPropagation();circuit.remove(i,w.item);onChange?.()}else if(tool==='Inspect'){e.stopPropagation();const n=circuit.nets.find(n=>n.wires.includes(w.item));const p=n?.drivers[0];if(p)onSelect?.({gate:p.item,pin:p.pin})}}}/>)}
        {circuit.gates.map((g,i)=><SVGGate key={i} gate={g.item} coords={drag?.i===i&&drag.preview?drag.preview:g.coords} scale={view.scale} origin={view.origin} selected={selection?.gate===g.item}
            onMouseDown={e=>gateMouseDown(g,i,e)}/>)}
        {sketch.length>1&&<SVGWire wire={new Wire(sketch)} scale={view.scale} origin={view.origin}/>}
    </svg>
}
