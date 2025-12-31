import { Pinout } from "./types"
import { Coord, coord } from "../../../lib/coord"

export class Gate {
    public size: Coord
    public pins: Pinout

    constructor(public name: string, size: Coord | [number, number], pins: {
        [key: string]: { type: 'in' | 'out', coord: Coord | [number, number], invert?: boolean }
    }) {
        this.name = name
        this.size = coord(size)
        this.pins = {}
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
