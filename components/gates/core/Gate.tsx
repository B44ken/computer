import { Pin, PinDecl, Pinout } from "./types"
import { Coord, coord } from "../../../lib/coord"
import { GateViewProps } from "./types"

export const GateView = ({ gate, width, children }: GateViewProps & { children: React.ReactNode }) => {
    const scale = width / gate.size.x
    const circ = (n: string, p: Pin) => <circle data-pin={n} key={n} cx={p.coord.x} cy={p.coord.y} r={p.invert ? 0.25 : 0.16} fill={p.voltage ? "#7e7" : "#000"} stroke="#999" strokeWidth={0.08}>
        <title>{n}: {p.voltage ? 1 : 0}</title>
    </circle>
    return <g transform={`scale(${scale})`}> {children} {Object.entries(gate.pins).map(([name, pin]) => circ(name, pin))} </g>
}

export class Gate {
    static type = "Gate"
    public size: Coord
    public pins: Pinout = {}
    rotation = 0
    transformScale = 1
    sequential = false
    constructor(public name: string | undefined, size: Coord | [number, number], pins: PinDecl, public view: (props: GateViewProps) => React.ReactNode) {
        this.size = coord(size)
        for (const [name, pin] of Object.entries(pins))
            this.pins[name] = { ...pin, coord: coord(pin.coord) }
    }
    get type() { return (this.constructor as typeof Gate).type }
    localToBoard(p: Coord, origin: Coord) {
        if (!this.rotation && this.transformScale === 1) return p.add(origin)
        const center = this.size.div(2), d = p.sub(center).mul(this.transformScale), a = this.rotation * Math.PI / 180
        return coord([d.x * Math.cos(a) - d.y * Math.sin(a), d.x * Math.sin(a) + d.y * Math.cos(a)]).add(center).add(origin)
    }
    pinPosition(pin: string, origin: Coord) { return this.localToBoard(this.pins[pin].coord, origin) }
    update() { return false }
    sample() { } // snapshot sequential inputs without changing any outputs
    commit() { return false }
    click() { }
    get(pin: string): boolean | undefined { return this.pins[pin]?.voltage }
    set(pin: string, value: boolean): boolean {
        const didChange = this.pins[pin].voltage !== value
        this.pins[pin].voltage = value
        return didChange
    }
}

export const makeGate = (type: string, size: [number, number], view: (props: GateViewProps) => React.ReactNode, pins: PinDecl, update: (g: Gate) => boolean, click?: (g: Gate) => void) => {
    return class extends Gate {
        static type = type
        constructor(name?: string) { super(name, size, pins, view) }
        update() { return update(this) }
        click() { click?.(this) }
    }
}
