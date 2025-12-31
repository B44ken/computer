import { Pin, PinDecl, Pinout } from "./types"
import { Coord, coord } from "../../../lib/coord"

import { GateViewProps } from "./types"

export const GateView = ({ gate, width, children }: GateViewProps & { children: React.ReactNode }) => {
    const scale = width / gate.size.x
    const circ = (n: string, p: Pin) => <circle key={n} cx={p.coord.x} cy={p.coord.y} r={p.invert ? 0.25 : 0.16} fill={p.voltage ? "#7e7" : "#000"} stroke="#999" strokeWidth={0.08} />
    return <g transform={`scale(${scale})`}> {children} {Object.entries(gate.pins).map(([name, pin]) => circ(name, pin))} </g>
}

export class Gate {
    public size: Coord
    public pins: Pinout = {}

    constructor(public name: string, size: Coord | [number, number], pins: PinDecl, public view: (props: GateViewProps) => React.ReactNode) {
        this.name = name
        this.size = coord(size)
        for (const [name, pin] of Object.entries(pins))
            this.pins[name] = { ...pin, coord: coord(pin.coord) }
    }
    update() { return false } // abstract
    click() { } // abstract
    get(pin: string): boolean | undefined { return this.pins[pin]?.voltage }
    set(pin: string, value: boolean): boolean {
        const didChange = this.pins[pin]?.voltage != value
        this.pins[pin].voltage = value
        return didChange
    }
}

export const makeGate = (type: string, size: [number, number], view: (props: GateViewProps) => React.ReactNode, pins: PinDecl, update: (g: Gate) => boolean) => {
    return class extends Gate {
        static type = type
        constructor(name?: string) { super(name, size, pins, view) }
        update() { return update(this) }
    }
}