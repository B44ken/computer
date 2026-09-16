import { Gate } from '../components/gates/core/Gate'
import { Wire } from '../components/gates/core/Wire'
import { Coord, coord } from './coord'

export type ComponentItem<T> = { item: T, coords: Coord }
type Endpoint = { item: Gate, pin: string }
type Connection = { from: Gate, to: Gate, fromPin: string, toPin: string, via: Wire }
export type Net = { wires: Wire[], drivers: Endpoint[], receivers: Endpoint[] }

export class Circuit {
    gates: ComponentItem<Gate>[] = []
    wires: ComponentItem<Wire>[] = []
    connections: Connection[] | null = null
    unconnected: Endpoint[] | null = null
    nets: Net[] = []
    private fanout = new Map<Gate, Connection[]>()
    private outputWires = new Map<Gate, Map<string, Wire[]>>()
    revision = 0
    add(item: Gate | Wire, coords?: Coord | [number, number]) {
        coords = coord(coords || [0, 0])
        if (item instanceof Gate) this.gates.push({ item, coords })
        else if (item instanceof Wire) this.wires.push({ item, coords })
        this.invalidate()
        return this
    }
    clone(): Circuit {
        const c = new Circuit()
        c.gates = [...this.gates]; c.wires = [...this.wires]
        c.connections = this.connections; c.unconnected = this.unconnected
        c.nets = this.nets; c.fanout = this.fanout; c.outputWires = this.outputWires
        c.revision = this.revision
        return c
    }
    remove(i: number, obj: Gate | Wire) {
        if (obj instanceof Gate) this.gates.splice(i, 1)
        else if (obj instanceof Wire) this.wires.splice(i, 1)
        this.invalidate()
    }
    invalidate() { this.connections = this.unconnected = null }

    buildConnections() {
        // Same endpoint-on-polyline rule as before, indexed in spatial buckets.
        // A geometric crossing is NOT a junction unless a wire ends there.
        const wires = this.wires.map(w => w.item), parent = wires.map((_, i) => i)
        const root = (i: number): number => parent[i] === i ? i : parent[i] = root(parent[i])
        const join = (a: number, b: number) => { parent[root(a)] = root(b) }
        const buckets = new Map<string, Set<number>>()
        const bucket = (p: Coord) => `${Math.floor(p.x / 8)},${Math.floor(p.y / 8)}`
        wires.forEach((w, i) => {
            for (let j = 1; j < w.path.length; j++) {
                const a = w.path[j - 1], b = w.path[j]
                for (let x = Math.floor(Math.min(a.x, b.x) / 8); x <= Math.floor(Math.max(a.x, b.x) / 8); x++)
                    for (let y = Math.floor(Math.min(a.y, b.y) / 8); y <= Math.floor(Math.max(a.y, b.y) / 8); y++) {
                        const key = `${x},${y}`
                        if (!buckets.has(key)) buckets.set(key, new Set())
                        buckets.get(key)!.add(i)
                    }
            }
        })
        const touching = (p: Coord) => [...(buckets.get(bucket(p)) || [])].filter(i => wires[i].has(p))
        wires.forEach((w, i) => {
            for (const p of [w.path[0], w.path[w.path.length - 1]].filter(Boolean))
                for (const j of touching(p)) join(i, j)
        })
        const pins = this.gates.flatMap(({ item, coords }) => Object.entries(item.pins).map(([pin, p]) => ({
            item, pin, type: p.type, touching: touching(p.coord.add(coords))
        })))
        for (const p of pins) for (const i of p.touching.slice(1)) join(p.touching[0], i)
        const nets = new Map<number, Net>()
        wires.forEach((w, i) => {
            const r = root(i)
            if (!nets.has(r)) nets.set(r, { wires: [], drivers: [], receivers: [] })
            nets.get(r)!.wires.push(w); w.voltage = false
        })
        for (const p of pins) if (p.touching.length) {
            const net = nets.get(root(p.touching[0]))!
            ;(p.type === 'out' ? net.drivers : net.receivers).push({ item: p.item, pin: p.pin })
        }
        const connections: Connection[] = [], driven = new Map<Gate, Set<string>>()
        this.fanout = new Map(); this.outputWires = new Map()
        for (const net of nets.values()) {
            if (net.drivers.length > 1) throw Error('multiple drivers: ' + net.drivers.map(p => `${p.item.name}.${p.pin}`).join(', '))
            for (const { item: from, pin: fromPin } of net.drivers) {
                if (!this.outputWires.has(from)) this.outputWires.set(from, new Map())
                const outs = this.outputWires.get(from)!
                outs.set(fromPin, [...(outs.get(fromPin) || []), ...net.wires])
                for (const { item: to, pin: toPin } of net.receivers) {
                    const conn = { from, to, fromPin, toPin, via: net.wires[0] }
                    connections.push(conn)
                    if (!this.fanout.has(from)) this.fanout.set(from, [])
                    this.fanout.get(from)!.push(conn)
                    if (!driven.has(to)) driven.set(to, new Set())
                    driven.get(to)!.add(toPin)
                }
            }
        }
        this.unconnected = pins.filter(p => p.type === 'in' && !driven.get(p.item)?.has(p.pin)).map(({ item, pin }) => ({ item, pin }))
        this.nets = [...nets.values()]; this.connections = connections
    }

    update(maxIters = 200) {
        if (!this.connections) this.buildConnections()
        let changed = false, evaluations = 0
        for (const { item, pin } of this.unconnected!) changed = item.set(pin, false) || changed
        let queue = this.gates.map(g => g.item)
        for (let phase = 0; phase < maxIters; phase++) {
            const queued = new Set(queue)
            for (let cursor = 0; cursor < queue.length; cursor++) {
                if (++evaluations > maxIters * Math.max(1, this.gates.length)) throw Error('circuit did not settle')
                const gate = queue[cursor]; queued.delete(gate)
                changed = gate.update() || changed
                for (const [pin, wires] of this.outputWires.get(gate) || [])
                    for (const wire of wires) wire.voltage = !!gate.get(pin)
                for (const conn of this.fanout.get(gate) || [])
                    if (conn.to.set(conn.toPin, !!gate.get(conn.fromPin))) {
                        changed = true
                        if (!queued.has(conn.to)) { queue.push(conn.to); queued.add(conn.to) }
                    }
            }
            // All combinational paths (including Cross clock paths) are settled.
            // Sample every sequential component BEFORE committing any of them.
            for (const { item } of this.gates) item.sample()
            queue = []
            for (const { item } of this.gates) if (item.commit()) queue.push(item)
            if (!queue.length) { if (changed) this.revision++; return changed }
            changed = true
        }
        throw Error('clock feedback did not settle')
    }
}
