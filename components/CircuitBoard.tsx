import { useCallback, useEffect, useRef, useState, PointerEvent } from 'react'
import { Circuit } from '../lib/circuit'
import { Wire } from './gates/core/Wire'
import { Gate } from './gates/core/Gate'
import { Coord, coord } from '../lib/coord'
import { placedSize } from '../lib/placement'
import { isValidPlacement } from '../lib/overlap'
import { Tool } from './Toolbox'

export type BoardView = { x: number, y: number, w: number, h: number }
type SVGWireProps = { wire: Wire, scale: number, origin: Coord, voltage?: boolean, onMouseDown?: () => void, onPointerDown?: (e: PointerEvent) => void }
type SVGGateProps = {
    gate: Gate, coords: Coord, scale: number, origin: Coord, rotation?: number,
    onMouseUp?: () => void, onMouseDown?: () => void, onPointerDown?: (e: PointerEvent) => void
}

export const SVGGate = ({ gate, coords, scale, origin, rotation = 0, ...events }: SVGGateProps) => {
    const [hover, setHover] = useState(false), size = placedSize(gate, rotation)
    coords = coords.sub(origin)
    return <g data-gate={gate.name} data-gate-type={(gate.constructor as typeof Gate & { type?: string }).type}
        transform={`translate(${coords.x * scale}, ${coords.y * scale})`}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...events}>
        <title>{gate.name || (gate.constructor as typeof Gate & { type?: string }).type}</title>
        <g transform={`translate(${size.x * scale / 2},${size.y * scale / 2}) rotate(${rotation * 90}) translate(${-gate.size.x * scale / 2},${-gate.size.y * scale / 2})`}>
            <gate.view gate={gate} width={gate.size.x * scale} height={gate.size.y * scale} hover={hover}/>
        </g>
    </g>
}

export const SVGWire = ({ wire, scale, origin, voltage, ...events }: SVGWireProps) => {
    const points = wire.path.map(c => c.sub(origin)).map(c => `${c.x},${c.y}`).join(' ')
    return <g transform={`scale(${scale})`}>
        <polyline points={points} fill="none" stroke={voltage === true ? '#239341' : '#999'} strokeWidth={0.12} {...events}/>
    </g>
}

type Props = { tool: Tool, circuit: Circuit, updateGate: (id: number, coords: Coord) => void,
    interact?: () => void, fitOnLoad?: boolean, focus?: BoardView | null, clockControls?: boolean,
    notes?: { x: number, y: number, text: string }[] }
type Drag = { kind: 'gate', index: number, start: Coord, offset: Coord, fresh?: boolean } | { kind: 'pan', start: Coord, view: BoardView } | { kind: 'wire', start: Coord }

export const CircuitBoard = ({ tool, circuit, updateGate, interact, fitOnLoad = false, focus, clockControls = true, notes = [] }: Props) => {
    const svg = useRef<SVGSVGElement>(null), drag = useRef<Drag | null>(null)
    const [view, setView] = useState<BoardView>({ x: 0, y: 0, w: 24, h: 16 })
    const [sketch, setSketch] = useState<Coord[]>([]), [selected, select] = useState<Gate | null>(null)
    const [, refresh] = useState(0)
    const changed = () => { circuit.update(); interact?.(); refresh(n => n + 1) }
    const adjusted = useCallback((v: BoardView) => {
        const rect = svg.current?.getBoundingClientRect()
        if (!rect || !rect.width || !rect.height) return v
        const scale = Math.min(rect.width / v.w, rect.height / v.h), w = rect.width / scale, h = rect.height / scale
        return { x: v.x - (w - v.w) / 2, y: v.y - (h - v.h) / 2, w, h }
    }, [])
    const fit = useCallback(() => {
        const points = circuit.wires.flatMap(w => w.item.path)
        for (const g of circuit.gates) points.push(g.coords, g.coords.add(placedSize(g.item, g.rotation)))
        for (const n of notes) points.push(coord([n.x, n.y - 1]), coord([n.x + n.text.length * 0.46, n.y + 1]))
        if (!points.length) return
        const x = Math.min(...points.map(p => p.x)) - 3, y = Math.min(...points.map(p => p.y)) - 3
        setView(adjusted({ x, y, w: Math.max(...points.map(p => p.x)) - x + 3, h: Math.max(...points.map(p => p.y)) - y + 3 }))
    }, [circuit, notes, adjusted])
    useEffect(() => {
        select(null)
        const el = svg.current!, rect = el.getBoundingClientRect()
        if (fitOnLoad) fit()
        else setView({ x: 0, y: 0, w: rect.width / 48, h: rect.height / 48 })
        const observer = new ResizeObserver(() => setView(v => adjusted(v)))
        observer.observe(el); return () => observer.disconnect()
    }, [circuit, fitOnLoad]) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (focus) setView(adjusted(focus)) }, [focus, adjusted])
    useEffect(() => {
        const el = svg.current!
        const wheel = (e: WheelEvent) => {
            e.preventDefault()
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(el.getScreenCTM()!.inverse()), f = e.deltaY < 0 ? 0.85 : 1 / 0.85
            setView(v => v.w * f < 4 || v.w * f > 2000 ? v : { x: p.x + (v.x - p.x) * f, y: p.y + (v.y - p.y) * f, w: v.w * f, h: v.h * f })
        }
        el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
    }, [])
    const world = (e: PointerEvent) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse()); return coord([p.x, p.y]) }
    const capture = (e: PointerEvent) => { e.preventDefault(); svg.current!.setPointerCapture(e.pointerId) }
    const down = (e: PointerEvent) => {
        capture(e)
        const p = world(e)
        if (typeof tool === 'function') {
            const n = circuit.gates.length
            circuit.add(new tool(), p.snap(0.5))
            if (circuit.gates.length > n) { select(circuit.gates[n].item); drag.current = { kind: 'gate', index: n, start: p.snap(0.5), offset: coord([0, 0]), fresh: true }; changed() }
        } else if (tool === 'Wire') { drag.current = { kind: 'wire', start: p.snap(0.5) }; setSketch([p.snap(0.5)]) }
        else if (tool === 'Interact') { drag.current = { kind: 'pan', start: coord([e.clientX, e.clientY]), view }; select(null) }
    }
    const gateDown = (e: PointerEvent, index: number) => {
        const g = circuit.gates[index]
        if (tool === 'Interact') { e.stopPropagation(); capture(e); select(g.item); drag.current = { kind: 'gate', index, start: g.coords, offset: world(e).sub(g.coords) } }
        else if (tool === 'Erase') { e.stopPropagation(); circuit.remove(index, g.item); select(null); changed() }
    }
    const move = (e: PointerEvent) => {
        const d = drag.current
        if (!d) return
        if (d.kind === 'gate') updateGate(d.index, world(e).sub(d.offset).snap(0.5))
        else if (d.kind === 'pan') {
            const rect = svg.current!.getBoundingClientRect()
            setView({ ...d.view, x: d.view.x - (e.clientX - d.start.x) * d.view.w / rect.width, y: d.view.y - (e.clientY - d.start.y) * d.view.h / rect.height })
        } else { const end = world(e).snap(0.5); setSketch([d.start, coord([end.x, d.start.y]), end]) }
    }
    const up = () => {
        const d = drag.current
        if (d?.kind === 'gate' && !d.fresh && circuit.gates[d.index]?.coords.eq(d.start)) { circuit.gates[d.index].item.click(); changed() }
        if (d?.kind === 'wire' && sketch.length > 1 && !sketch[0].eq(sketch[sketch.length - 1])) { circuit.add(new Wire(sketch)); changed() }
        drag.current = null; setSketch([])
    }
    const zoom = (f: number) => setView(v => ({ x: v.x + v.w * (1 - f) / 2, y: v.y + v.h * (1 - f) / 2, w: v.w * f, h: v.h * f }))
    const rotate = () => {
        const i = circuit.gates.findIndex(g => g.item === selected), g = circuit.gates[i]
        if (!g) return
        const rotation = ((g.rotation || 0) + 1) % 4
        if (isValidPlacement(circuit, g.item, g.coords, i, rotation)) { g.rotation = rotation; circuit.invalidate(); changed() }
    }
    const clocked = circuit.gates.some(g => g.item.sample !== Gate.prototype.sample)
    return <div data-testid="native-circuit" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px', flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
            <button onClick={fit}>fit</button><button aria-label="zoom in" onClick={() => zoom(0.7)}>+</button><button aria-label="zoom out" onClick={() => zoom(1 / 0.7)}>−</button>
            <button disabled={!selected} onClick={rotate}>rotate</button>
            {clockControls && clocked && <><button onClick={() => { circuit.tick(); changed() }}>tick</button><button onClick={() => { circuit.reset(); changed() }}>reset state</button></>}
            <span style={{ marginLeft: 'auto' }}>{circuit.gates.length} components · {circuit.wires.length} wires</span>
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <svg ref={svg} data-testid="circuit-board" aria-label="editable logic circuit" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', userSelect: 'none', background: '#fafafa', border: '1px solid #ccc' }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setSketch([]) }}>
            {notes.map((n, i) => <text key={i} x={n.x} y={n.y} fill="#666" fontSize={0.8} style={{ pointerEvents: 'none' }}>{n.text}</text>)}
            {circuit.wires.map((w, i) => <SVGWire key={i} wire={w.item} scale={1} origin={coord([0, 0])} voltage={circuit.voltage(w.item)}
                onPointerDown={e => { if (tool === 'Erase') { e.stopPropagation(); circuit.remove(i, w.item); changed() } }}/>) }
            {circuit.gates.map((g, i) => <SVGGate key={i} gate={g.item} coords={g.coords} rotation={g.rotation} scale={1} origin={coord([0, 0])} onPointerDown={e => gateDown(e, i)}/>)}
            {sketch.length > 1 && <SVGWire wire={new Wire(sketch)} scale={1} origin={coord([0, 0])}/>}
        </svg>
        </div>
        <div data-testid="circuit-inspector" style={{ padding: '6px 10px', minHeight: 34, fontSize: 11, overflowWrap: 'anywhere' }}>
            {circuit.errors.length ? circuit.errors.join('; ') : selected ? <><strong>{selected.name || (selected.constructor as typeof Gate & { type?: string }).type}</strong> · {Object.entries(selected.pins).map(([p, v]) => `${p}=${Number(Boolean(v.voltage))}`).join(' · ')}</> : 'drag gates to move · drag background to pan · scroll to zoom · erase/wire tools edit the actual circuit'}
            {!circuit.errors.length && !!circuit.unconnected?.length && <span> · {circuit.unconnected.length} unconnected inputs</span>}
        </div>
    </div>
}
