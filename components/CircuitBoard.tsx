import { useState } from 'react'
import { Circuit } from '../lib/circuit'
import { Wire } from './gates'
import { Gate } from './gates/core/Gate'
import { Coord, coord } from '../lib/coord'
import { Tool } from './Toolbox'

type DragState = { i?: number, start: Coord, offset?: Coord, pan?: boolean }
type SVGWireProps = { wire: Wire, scale: number, origin: Coord, onMouseDown?: () => void }
type SVGGateProps = {
    gate: Gate, coords: Coord, scale: number, origin: Coord,
    onMouseUp?: () => void, onMouseDown?: () => void
}

export const SVGGate = ({ gate, coords, scale, origin, onMouseUp, onMouseDown }: SVGGateProps) => {
    const [hover, setHover] = useState(false)
    coords = coords.sub(origin)
    return <g transform={`translate(${coords.x * scale}, ${coords.y * scale})`}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onMouseUp={onMouseUp} onMouseDown={onMouseDown}>
        <gate.view gate={gate} width={gate.size.x * scale} height={gate.size.y * scale} hover={hover} />
    </g>
}

export const SVGWire = ({ wire, scale, origin, onMouseDown }: SVGWireProps) => {
    const points = wire.path.map((c) => c.sub(origin)).map((c) => `${c.x},${c.y}`).join(' ')
    return <g transform={`scale(${scale})`}>
        <polyline points={points} fill="none" stroke="#999" strokeWidth={0.16} onMouseDown={onMouseDown} />
    </g>
}

export const CircuitBoard = ({ tool, circuit, updateGate }: { tool: Tool, circuit: Circuit, updateGate: (id: number, coords: Coord) => void }) => {
    const scale = 48
    const [origin, setOrigin] = useState(coord([0, 0]))
    const [drag, setDrag] = useState<DragState | null>(null)
    const [mouse, setMouse] = useState(coord([0, 0]))
    const [sketch, setSketch] = useState<Coord[]>([])

    const mouseUp = () => {
        if (sketch.length) circuit.add(new Wire([...sketch, mouse.round()]))
        setSketch([])
        setDrag(null)
    }

    const mouseMove = ({ nativeEvent }: { nativeEvent: MouseEvent }) => {
        setMouse(origin.add(coord([nativeEvent.offsetX, nativeEvent.offsetY]).div(scale)))
        if (drag?.pan) setOrigin(origin.sub(coord([nativeEvent.movementX, nativeEvent.movementY]).div(scale)))
        else if (drag) updateGate(drag.i, mouse.sub(drag.offset).round())
        else if (sketch.length) {
            const prev = sketch[sketch.length - 1], mr = mouse.round(), diff = prev.sub(mr)
            setSketch([...sketch, mr.add((Math.abs(diff.x) > Math.abs(diff.y)) ? [0, diff.y] : [diff.x, 0])])
        }
    }

    const gateMouseDown = ({ item, coords }: { item: Gate, coords: Coord }, i: number) => {
        if (tool == "Interact") setDrag({ i, start: coords, offset: mouse.sub(coords) })
        else if (tool == "Erase") circuit.remove(i, item)
    }

    const wireMouseDown = ({ item }: { item: Wire }, i: number) =>
        (tool == "Erase") && circuit.remove(i, item)

    const mouseDown = ({ target }: { target: EventTarget }) => {
        if (typeof tool == 'function') {
            circuit.add(new tool(), mouse)
            setDrag({ i: circuit.gates.length - 1, start: mouse.round(), offset: coord([0, 0]) })
        } else if (tool == "Wire") setSketch([mouse.round()])
        else if (tool == "Interact" && (target as SVGElement).tagName == "svg") setDrag({ start: mouse, pan: true })
    }

    const dots = `bg-[radial-gradient(#eee_2px,#fff_2px)] bg-position-[24px_24px] bg-size-[48px_48px]`
    return <svg className={`border-2 w-full h-7/8 ${dots}`} onMouseMove={mouseMove} onMouseUp={mouseUp} onMouseDown={mouseDown}>
        {circuit.wires.map((w, i) => <SVGWire key={i} wire={w.item} {...{ scale, origin }} onMouseDown={() => wireMouseDown(w, i)} />)}
        {circuit.gates.map((g, i) => <SVGGate key={i} gate={g.item} {...{ scale, origin }} coords={g.coords}
            onMouseUp={() => drag?.start.eq(g.coords) && g.item.click()} onMouseDown={() => gateMouseDown(g, i)}
        />)}
        {sketch.length > 0 && <SVGWire wire={new Wire(sketch)} {...{ scale, origin }} />}
        {/* <text x={1000} y={scale} textAnchor="end">{mouse.x.toFixed(2)} {mouse.y.toFixed(2)}</text> */}
    </svg >
}