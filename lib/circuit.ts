import { Gate, Wire } from "../components/gates";
import { Coord, coord } from "./coord";

export type ComponentItem<T> = { item: T, coords: Coord }
type Connection = { from: Gate, to: Gate, fromPin: string, toPin: string, via: Wire }

export class Circuit {
    gates: ComponentItem<Gate>[] = []
    wires: ComponentItem<Wire>[] = []
    connections: Connection[] | null = null
    unconnected: { item: Gate, pin: string }[] | null = null
    add(item: Gate | Wire, coords?: Coord | [number, number]) {
        coords = coord(coords || [0, 0])
        if (item instanceof Gate) this.gates.push({ item, coords })
        else if (item instanceof Wire) this.wires.push({ item, coords })
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
                if (item.pins[name].type == 'in')
                    if (!driven.get(item)?.has(name))
                        this.unconnected.push({ item, pin: name })
    }


    buildConnections() {
        const nets = new Map<Wire, Set<Wire>>()

        for (const { item } of this.wires)
            nets.set(item, new Set([item]))

        const wires = this.wires.map(w => w.item)
        for (let i = 0; i < wires.length; i++) {
            for (let j = i + 1; j < wires.length; j++) {
                const w1 = wires[i], w2 = wires[j]

                const connected = w2.has(w1.path[0]) || w2.has(w1.path[w1.path.length - 1]) || w1.has(w2.path[0]) || w1.has(w2.path[w2.path.length - 1])
                if (!connected) continue
                const set1 = nets.get(w1)!, set2 = nets.get(w2)!
                if (set1 != set2) {
                    for (const w of set2) {
                        set1.add(w)
                        nets.set(w, set1)
                    }
                }
            }
        }

        const uniqueNets = new Set<Set<Wire>>(nets.values())

        const conns: Connection[] = []

        for (const net of uniqueNets) {
            const drivers: { item: Gate, pin: string }[] = []
            const receivers: { item: Gate, pin: string }[] = []

            for (const g of this.gates) {
                for (const pName in g.item.pins) {
                    const pin = g.item.pins[pName]
                    const pinPos = pin.coord.add(g.coords)

                    let onNet = [...net].some(w => w.has(pinPos))

                    if (onNet) {
                        if (pin.type == 'out') drivers.push({ item: g.item, pin: pName })
                        else if (pin.type == 'in') receivers.push({ item: g.item, pin: pName })
                    }
                }
            }

            const representativeWire = net.values().next().value
            for (const { item: from, pin: fromPin } of drivers)
                for (const { item: to, pin: toPin } of receivers)
                    conns.push({ from, to, fromPin, toPin, via: representativeWire })
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