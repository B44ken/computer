import { Gate } from "../components/gates/core/Gate"
import { Wire } from "../components/gates/core/Wire"
import { Coord, coord, isPointOnSegment } from "./coord"

export type ComponentItem<T> = { item: T, coords: Coord }
export type PinRef = { item: Gate, pin: string }
export type Connection = { from: Gate, to: Gate, fromPin: string, toPin: string, via: Wire }
export type Net = { wires: Wire[], drivers: PinRef[], receivers: PinRef[] }
export type Annotation = { text: string, x: number, y: number, width?: number, height?: number }

export class Circuit {
    gates: ComponentItem<Gate>[] = []
    wires: ComponentItem<Wire>[] = []
    connections: Connection[] | null = null
    unconnected: PinRef[] | null = null
    nets: Net[] = []
    annotations: Annotation[] = []
    private outgoing = new Map<Gate, Connection[]>()
    private pinNets = new Map<Gate, Map<string, Net>>()
    add(item: Gate | Wire, coords?: Coord | [number, number]) {
        const p = coord(coords || [0, 0])
        if (item instanceof Gate) this.gates.push({ item, coords: p })
        else this.wires.push({ item, coords: p })
        this.invalidate()
        return this
    }
    clone(): Circuit {
        const c = new Circuit()
        c.gates = this.gates.map(g => ({ ...g }))
        c.wires = [...this.wires]
        c.connections = this.connections
        c.unconnected = this.unconnected
        c.nets = this.nets
        c.outgoing = this.outgoing
        c.pinNets = this.pinNets
        c.annotations = this.annotations
        return c
    }
    remove(i: number, obj: Gate | Wire) {
        if (obj instanceof Gate) this.gates.splice(i, 1)
        else this.wires.splice(i, 1)
        this.invalidate()
    }
    invalidate() { this.connections = this.unconnected = null; this.nets = []; this.pinNets = new Map(); this.outgoing = new Map() }

    buildConnections() {
        // Same geometric rule as the editor: touching endpoints join wires;
        // an interior/interior crossing alone does not. Index segment bounds
        // rather than comparing every wire with every other wire.
        const wires = this.wires.map(w => w.item), parent = wires.map((_, i) => i)
        const find = (i: number): number => parent[i] === i ? i : parent[i] = find(parent[i])
        const join = (a: number, b: number) => { parent[find(a)] = find(b) }
        const buckets = new Map<string, { a: Coord, b: Coord, wire: number }[]>()
        const bucketSize = 4, eps = 1e-8
        wires.forEach((wire, i) => {
            for (let j = 1; j < wire.path.length; j++) {
                const a = wire.path[j - 1], b = wire.path[j], segment = { a, b, wire: i }
                for (let x = Math.floor((Math.min(a.x, b.x) - eps) / bucketSize); x <= Math.floor((Math.max(a.x, b.x) + eps) / bucketSize); x++)
                    for (let y = Math.floor((Math.min(a.y, b.y) - eps) / bucketSize); y <= Math.floor((Math.max(a.y, b.y) + eps) / bucketSize); y++) {
                        const key = `${x},${y}`
                        if (!buckets.has(key)) buckets.set(key, [])
                        buckets.get(key)!.push(segment)
                    }
            }
        })
        const at = (p: Coord) => [...new Set((buckets.get(`${Math.floor(p.x / bucketSize)},${Math.floor(p.y / bucketSize)}`) || [])
            .filter(s => isPointOnSegment(p, s.a, s.b)).map(s => s.wire))]
        wires.forEach((wire, i) => {
            for (const p of [wire.path[0], wire.path[wire.path.length - 1]]) if (p)
                for (const other of at(p)) join(i, other)
        })
        const pins = this.gates.flatMap(({ item, coords }) => Object.keys(item.pins).map(pin => ({ item, pin, on: at(item.pinPosition(pin, coords)) })))
        for (const p of pins) for (const other of p.on) join(p.on[0], other)
        const groups = new Map<number, Net>()
        wires.forEach((w, i) => {
            const root = find(i)
            if (!groups.has(root)) groups.set(root, { wires: [], drivers: [], receivers: [] })
            groups.get(root)!.wires.push(w)
        })
        this.pinNets = new Map()
        for (const p of pins) {
            if (!p.on.length) continue
            const net = groups.get(find(p.on[0]))!
            net[p.item.pins[p.pin].type === 'out' ? 'drivers' : 'receivers'].push({ item: p.item, pin: p.pin })
            if (!this.pinNets.has(p.item)) this.pinNets.set(p.item, new Map())
            this.pinNets.get(p.item)!.set(p.pin, net)
        }
        this.nets = [...groups.values()]
        this.connections = []
        this.outgoing = new Map()
        const driven = new Map<Gate, Set<string>>()
        for (const net of this.nets) {
            if (net.drivers.length > 1) throw Error(`short: ${net.drivers.map(p => `${p.item.name}.${p.pin}`).join(' / ')}`)
            for (const from of net.drivers) for (const to of net.receivers) {
                const c = { from: from.item, fromPin: from.pin, to: to.item, toPin: to.pin, via: net.wires[0] }
                this.connections.push(c)
                if (!this.outgoing.has(from.item)) this.outgoing.set(from.item, [])
                this.outgoing.get(from.item)!.push(c)
                if (!driven.has(to.item)) driven.set(to.item, new Set())
                driven.get(to.item)!.add(to.pin)
            }
        }
        this.unconnected = pins.filter(p => p.item.pins[p.pin].type === 'in' && !driven.get(p.item)?.has(p.pin)).map(({ item, pin }) => ({ item, pin }))
    }
    netAt(item: Gate, pin: string) {
        if (!this.connections) this.buildConnections()
        return this.pinNets.get(item)?.get(pin)
    }
    trace(item: Gate, pin: string) {
        const start = this.netAt(item, pin), nets = new Set<Net>(), wires = new Set<Wire>()
        if (!start) return wires
        const queue = [start]
        for (let i = 0; i < queue.length; i++) {
            const net = queue[i]
            if (nets.has(net)) continue
            nets.add(net)
            for (const wire of net.wires) wires.add(wire)
            for (const p of [...net.drivers, ...net.receivers]) if (p.item.type === 'Cross') {
                const other = { TL: 'BR', BR: 'TL', TR: 'BL', BL: 'TR' }[p.pin]
                const next = this.netAt(p.item, other)
                if (next && !nets.has(next)) queue.push(next)
            }
        }
        return wires
    }
    update(maxIters = 1024) {
        if (!this.connections) this.buildConnections()
        let changed = false
        for (const { item, pin } of this.unconnected!) changed = item.set(pin, false) || changed
        const settle = (seeds: Gate[]) => {
            const queue = [...seeds], pending = new Set(queue)
            const budget = Math.max(1, this.gates.length) * maxIters
            for (let i = 0; i < queue.length; i++) {
                if (i > budget) throw Error('circuit did not settle (combinational oscillation)')
                const gate = queue[i]; pending.delete(gate)
                changed = gate.update() || changed
                for (const c of this.outgoing.get(gate) || []) if (c.to.set(c.toPin, !!gate.get(c.fromPin))) {
                    changed = true
                    if (!pending.has(c.to)) { pending.add(c.to); queue.push(c.to) }
                }
            }
        }
        settle(this.gates.map(g => g.item))
        const sequential = this.gates.map(g => g.item).filter(g => g.sequential)
        for (const gate of sequential) gate.sample()
        const committed = sequential.filter(gate => gate.commit())
        if (committed.length) { changed = true; settle(committed) }
        for (const net of this.nets) for (const wire of net.wires)
            wire.voltage = !!net.drivers[0]?.item.get(net.drivers[0].pin)
        return changed
    }
}
