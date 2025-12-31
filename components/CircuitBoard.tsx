import { useState } from 'react'
import { Circuit } from '../lib/circuit'
import { Wire } from './gates'
import { Gate } from './gates/core/Gate'
import { GateView as DefaultGateView } from './gates/views/GateView'
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
    return <polyline points={points} fill="none" stroke="black" strokeWidth={scale * 0.15} onMouseDown={onMouseDown} />
}

export const CircuitBoard = ({ tool, circuit, onGateMove }: { tool: Tool, circuit: Circuit, onGateMove: (id: number, coords: Coord) => void }) => {
    const scale = 48
    const [origin, setOrigin] = useState(coord([0, 0]))
    const [drag, setDrag] = useState<DragState | null>(null)
    const [mouse, setMouse] = useState<Coord>(coord([0, 0]))

    const [sketch, setSketch] = useState<Coord[]>([])

    const mouseUp = () => {
        if (sketch.length) {
            circuit.add(new Wire([...sketch, mouse.round()]))
            setSketch([])
        }
        setDrag(null)
    }

    const mouseMove = (e: React.MouseEvent) => {
        setMouse(coord([e.nativeEvent.offsetX, e.nativeEvent.offsetY]).div(scale))
        if (drag?.pan) setOrigin(drag.start.sub(mouse))
        else if (drag) onGateMove(drag.i, mouse.sub(drag.offset).round())
        else if (sketch.length) {
            const prev = sketch[sketch.length - 1], mr = mouse.round()
            if (!prev.eq(mr)) {
                if (Math.abs(prev.x - mr.x) > Math.abs(prev.y - mr.y))
                    setSketch([...sketch, mr.add(coord([0, prev.y - mr.y]))])
                else
                    setSketch([...sketch, mr.add(coord([prev.x - mr.x, 0]))])
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

    const mouseDown = ({ target }: { target: EventTarget }) => {
        if (typeof tool == 'function') {
            const inst = new tool()
            circuit.add(inst, mouse)
            setDrag({ i: circuit.gates.length - 1, start: mouse.round(), offset: coord([0, 0]) })
        } else if (tool == "Wire") setSketch([mouse.round()])
        else if (tool == "Interact" && (target as SVGElement).tagName == "svg") setDrag({ start: origin.add(mouse), pan: true })
    }

    const dots = `bg-[radial-gradient(#eee_2px,transparent_2px)] bg-position-[${scale / 2}px_${scale / 2}px] bg-size-[${scale}px_${scale}px]`
    return <svg className={`border-2 w-full h-7/8 ${dots}`} onMouseMove={mouseMove} onMouseUp={mouseUp} onMouseDown={mouseDown}>
        {circuit.wires.map((obj, i) => <SVGWire key={i} wire={obj.item} scale={scale} origin={origin} onMouseDown={() => wireMouseDown(obj, i)} />)}
        {circuit.gates.map((obj, i) => <SVGGate key={i} gate={obj.item} scale={scale} coords={obj.coords} origin={origin}
            onMouseUp={() => drag?.start.eq(obj.coords) && obj.item.click()}
            onMouseDown={() => gateMouseDown(obj, i)}
        />)}
        {sketch.length > 0 && <SVGWire wire={new Wire(sketch.concat(mouse.round()))} scale={scale} origin={origin} />}
        {/* <text x={W - 6} y={scale} textAnchor="end">{mouse.x.toFixed(2)} {mouse.y.toFixed(2)}</text> */}
    </svg >
}