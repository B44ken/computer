import { useState } from 'react'
import { Circuit } from '../lib/circuit'
import { Wire } from './gates'
import { Gate } from './gates/core/Gate'
import { GateView as DefaultGateView } from './gates/views/GateView'
import { Coord, coord } from '../lib/coord'
import { Tool } from './Toolbox'

type DragState = { i: number, start: Coord, offset: Coord }
type SVGWireProps = { wire: Wire, scale: number, origin: Coord, onMouseDown?: () => void }
type SVGGateProps = {
    gate: Gate, coords: Coord, scale: number, origin: Coord,
    onMouseUp?: () => void, onMouseDown?: () => void
}

export const SVGGate = ({ gate, coords, scale, origin, onMouseUp, onMouseDown }: SVGGateProps) => {
    const [hover, setHover] = useState(false)
    const GateView = (gate.constructor as any).View || DefaultGateView
    coords = coords.sub(origin)

    return <g transform={`translate(${coords.x * scale}, ${coords.y * scale})`}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onMouseUp={onMouseUp} onMouseDown={onMouseDown}>
        <GateView gate={gate} width={gate.size.x * scale} height={gate.size.y * scale} hover={hover} />
    </g>
}

export const SVGWire = ({ wire, scale, origin, onMouseDown }: SVGWireProps) => {
    const points = wire.path.map((c) => c.sub(origin)).map((c) => `${c.x * scale},${c.y * scale}`).join(' ')
    return <polyline points={points} fill="none" stroke="black" strokeWidth={4} onMouseDown={onMouseDown} />
}

export const CircuitBoard = ({ tool, circuit, onGateMove }: { tool: Tool, circuit: Circuit, onGateMove: (id: number, coords: Coord) => void }) => {
    const scale = 24, origin = coord([0, 0])
    const [drag, setDrag] = useState<DragState | null>(null)
    const [mouse, setMouse] = useState<Coord>(coord([0, 0]))

    const [wireSketch, setWireSketch] = useState<Coord[]>([])

    const mouseUp = () => {
        if (wireSketch.length) {
            circuit.add(new Wire([...wireSketch, mouse.round()]))
            setWireSketch([])
        } else if (typeof tool == 'function') circuit.add(new tool(), mouse)
        setDrag(null)
    }

    const mouseMove = (e: React.MouseEvent) => {
        setMouse(coord([e.nativeEvent.offsetX, e.nativeEvent.offsetY]).div(scale))
        if (drag) onGateMove(drag.i, mouse.sub(drag.offset).round())

        if (wireSketch.length) {
            // only add horizntal lines
            const prev = wireSketch[wireSketch.length - 1], mr = mouse.round()
            if (!prev.eq(mr)) {
                if (Math.abs(prev.x - mr.x) > Math.abs(prev.y - mr.y)) {
                    setWireSketch([...wireSketch, mr.add(coord([0, prev.y - mr.y]))])
                } else {
                    setWireSketch([...wireSketch, mr.add(coord([prev.x - mr.x, 0]))])
                }
            }
        }
    }

    const gateMouseDown = ({ item, coords }: { item: Gate, coords: Coord }, i: number) => {
        if (tool == "Interact") setDrag({ i, start: coords, offset: mouse.sub(coords) })
        else if (tool == "Erase") circuit.remove(i, item)
    }

    const wireMouseDown = ({ item }: { item: Wire }, i: number) => {
        if (tool == "Erase") circuit.remove(i, item)
    }

    const mouseDown = () => {
        if (tool == "Wire") setWireSketch([mouse.round()])
    }

    return <svg className='border-2 w-3/4 h-3/4' onMouseMove={mouseMove} onMouseUp={mouseUp} onMouseDown={mouseDown}>
        {circuit.wires.map((obj, i) => <SVGWire key={i} wire={obj.item} scale={scale} origin={origin} onMouseDown={() => wireMouseDown(obj, i)} />)}
        {circuit.gates.map((obj, i) => <SVGGate key={i} gate={obj.item} scale={scale} coords={obj.coords} origin={origin}
            onMouseUp={() => drag?.start.eq(obj.coords) && obj.item.click()}
            onMouseDown={() => gateMouseDown(obj, i)}
        />)}
        {wireSketch.length > 0 && <SVGWire wire={new Wire(wireSketch.concat(mouse.round()))} scale={scale} origin={origin} />}
        {/* <text x={W - 6} y={scale} textAnchor="end">{mouse.x.toFixed(2)} {mouse.y.toFixed(2)}</text> */}
    </svg >
}