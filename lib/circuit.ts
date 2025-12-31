import { Gate, Wire } from "../components/gates";
import { Coord, coord } from "./coord";

export type ComponentItem<T> = { item: T, coords: Coord }
type Connection = { from: Gate, to: Gate, fromPin: string, toPin: string, via: Wire }

export class Circuit {
    gates: ComponentItem<Gate>[] = []
    wires: ComponentItem<Wire>[] = []
    connections: Connection[] | null = null
    unconnected: { item: Gate, pin: string }[] | null = null
    add(c: Gate | Wire, cd?: Coord | [number, number]) {
        cd = coord(cd || [0, 0])
        if (c instanceof Gate) this.gates.push({ item: c, coords: cd })
        else if (c instanceof Wire) this.wires.push({ item: c, coords: cd })
        else console.warn("tried to add", c)
        this.invalidate()
        return this
    }

    clone(): Circuit {
        const c = new Circuit()
        c.gates = [...this.gates]
        c.wires = [...this.wires]
        c.invalidate()
        return c
    }

    remove(i: number, obj: Gate | Wire) {
        if (obj instanceof Gate) this.gates.splice(i, 1)
        else if (obj instanceof Wire) this.wires.splice(i, 1)
        this.invalidate()
    }

    private findPinAt(pos: Coord) {
        for (const g of this.gates) {
            for (const p in g.item.pins) {
                const pin = g.item.pins[p]
                const abs = pin.coord.add(g.coords)
                if (abs.eq(pos)) return { item: g.item, pin: p, type: pin.type }
            }
        }
    }

    invalidate() { this.connections = this.unconnected = null }

    private buildUnconnected() {
        const driven = new Map<Gate, Set<string>>()
        if (this.connections)
            for (const conn of this.connections) {
                if (!driven.has(conn.to)) driven.set(conn.to, new Set())
                driven.get(conn.to)!.add(conn.toPin)
            }

        this.unconnected = []
        for (const { item } of this.gates)
            for (const name in item.pins)
                if (item.pins[name].type === 'in')
                    if (!driven.get(item)?.has(name))
                        this.unconnected.push({ item, pin: name })
    }

    buildConnections() {
        let conns: Connection[] = []
        for (const w of this.wires) {
            // todo something about non-termini wire connections
            const start = this.findPinAt(w.item.path[0])
            const end = this.findPinAt(w.item.path[w.item.path.length - 1])

            if (start && end) {
                if (start.type === 'out' && end.type === 'in')
                    conns.push({ from: start.item, to: end.item, fromPin: start.pin, toPin: end.pin, via: w.item })
                else if (end.type === 'out' && start.type === 'in')
                    conns.push({ from: end.item, to: start.item, fromPin: end.pin, toPin: start.pin, via: w.item })
            }
        }
        this.connections = conns
    }

    update(maxIters = 20) {
        if (!this.connections) this.buildConnections()
        if (!this.unconnected) this.buildUnconnected()

        for (const { item, pin } of this.unconnected)
            item.set(pin, false)

        let stable = false
        for (let i = 0; i < maxIters; i++) {
            stable = true

            for (const { from, to, fromPin, toPin } of this.connections)
                stable = !to.set(toPin, from.get(fromPin)) && stable

            for (const { item } of this.gates)
                stable = !item.update() && stable
        }
    }
}