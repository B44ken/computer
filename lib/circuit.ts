import { Gate } from '../components/gates/core/Gate'
import { Wire } from '../components/gates/core/Wire'
import { Coord, coord, isPointOnSegment } from './coord'
import { isValidPlacement } from './overlap'
import { localPoint } from './placement'

export type ComponentItem<T> = { item: T, coords: Coord, rotation?: number }
type Driver = { from: Gate, fromPin: string }
type Connection = Driver & { to: Gate, toPin: string, via: Wire }

// Preserve the editor's junction semantics: a wire vertex touching another
// segment joins it; a crossing between two segment interiors does not.
// Generated single-layer boards use explicit Cross components at every crossing.
function joins(a: Coord, b: Coord, c: Coord, d: Coord) {
    return isPointOnSegment(a, c, d) || isPointOnSegment(b, c, d) || isPointOnSegment(c, a, b) || isPointOnSegment(d, a, b)
}

export class Circuit {
    gates: ComponentItem<Gate>[] = []
    wires: ComponentItem<Wire>[] = []
    connections: Connection[] | null = null
    unconnected: { item: Gate, pin: string }[] | null = null
    wireDrivers = new Map<Wire, Driver>()
    errors: string[] = []
    cycles = 0
    private fanout = new Map<Gate, Connection[]>()

    add(item: Gate | Wire, coords?: Coord | [number, number], rotation = 0) {
        coords = coord(coords || [0, 0])
        if (!isValidPlacement(this, item, coords, undefined, rotation)) return this
        if (item instanceof Gate) this.gates.push({ item, coords, rotation })
        else this.wires.push({ item, coords })
        this.invalidate()
        return this
    }
    clone(): Circuit {
        const c = new Circuit()
        c.gates = [...this.gates]; c.wires = [...this.wires]; c.cycles = this.cycles
        return c
    }
    remove(i: number, obj: Gate | Wire) {
        if (obj instanceof Gate) this.gates.splice(i, 1)
        else this.wires.splice(i, 1)
        this.invalidate()
    }
    invalidate() { this.connections = this.unconnected = null; this.wireDrivers.clear(); this.errors = [] }
    pinPosition(g: ComponentItem<Gate>, pin: string) { return localPoint(g.item, g.item.pins[pin].coord, g.rotation).add(g.coords) }

    buildConnections() {
        // Spatial buckets avoid comparing every segment with every other segment.
        // Only geometry is used: there are no net IDs or CPU-specific connections.
        this.errors = []; this.wireDrivers.clear(); this.fanout.clear()
        const wires = this.wires.map(w => w.item), parent = wires.map((_, i) => i)
        const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]))
        const join = (i: number, j: number) => { parent[root(j)] = root(i) }
        type Segment = { a: Coord, b: Coord, wire: number }
        const buckets = new Map<string, Segment[]>()
        const bucket = (p: Coord) => `${Math.floor(p.x / 8)},${Math.floor(p.y / 8)}`
        wires.forEach((w, i) => {
            for (let j = 1; j < w.path.length; j++) {
                const a = w.path[j - 1], b = w.path[j], seen = new Set<Segment>()
                const keys: string[] = []
                for (let y = Math.floor(Math.min(a.y, b.y) / 8); y <= Math.floor(Math.max(a.y, b.y) / 8); y++)
                    for (let x = Math.floor(Math.min(a.x, b.x) / 8); x <= Math.floor(Math.max(a.x, b.x) / 8); x++) keys.push(`${x},${y}`)
                for (const k of keys) for (const s of buckets.get(k) || []) if (!seen.has(s)) {
                    seen.add(s)
                    if (root(i) !== root(s.wire) && joins(a, b, s.a, s.b)) join(i, s.wire)
                }
                const s = { a, b, wire: i }
                for (const k of keys) { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(s) }
            }
        })
        type Pin = { item: Gate, pin: string }
        const pins: { pin: Pin, wires: number[], point: string }[] = []
        for (const g of this.gates) for (const pin in g.item.pins) {
            const p = this.pinPosition(g, pin), candidates = new Set((buckets.get(bucket(p)) || []).map(s => s.wire))
            const touching = [...candidates].filter(i => wires[i].has(p))
            for (const i of touching.slice(1)) join(touching[0], i)
            pins.push({ pin: { item: g.item, pin }, wires: touching, point: `${p.x},${p.y}` })
        }
        // Coincident pins can connect directly, without a zero-length wire.
        const atPoint = new Map<string, number[]>()
        for (const p of pins) { if (!atPoint.has(p.point)) atPoint.set(p.point, []); atPoint.get(p.point)!.push(...p.wires) }
        for (const ns of atPoint.values()) for (const n of ns.slice(1)) join(ns[0], n)
        const groups = new Map<string, Pin[]>()
        for (const p of pins) {
            const ws = atPoint.get(p.point)!, k = ws.length ? `wire:${root(ws[0])}` : `point:${p.point}`
            if (!groups.has(k)) groups.set(k, [])
            groups.get(k)!.push(p.pin)
        }
        this.connections = []; this.unconnected = []
        const drivers = new Map<number, Driver>()
        for (const [k, ps] of groups) {
            const sources = ps.filter(p => p.item.pins[p.pin].type === 'out')
            const sinks = ps.filter(p => p.item.pins[p.pin].type === 'in')
            if (sources.length > 1) this.errors.push(`short: ${sources.map(p => `${p.item.name}.${p.pin}`).join(' / ')}`)
            if (sources.length !== 1) { this.unconnected.push(...sinks); continue }
            const source = { from: sources[0].item, fromPin: sources[0].pin }
            const wire = k.startsWith('wire:') ? Number(k.slice(5)) : -1
            if (wire >= 0) drivers.set(wire, source)
            for (const sink of sinks) {
                const connection = { ...source, to: sink.item, toPin: sink.pin, via: wires[wire] }
                this.connections.push(connection)
                if (!this.fanout.has(source.from)) this.fanout.set(source.from, [])
                this.fanout.get(source.from)!.push(connection)
            }
        }
        wires.forEach((w, i) => { const driver = drivers.get(root(i)); if (driver) this.wireDrivers.set(w, driver) })
    }

    update(maxEvents = 1000000) {
        if (!this.connections) this.buildConnections()
        if (this.errors.length) return false
        let changed = false
        for (const { item, pin } of this.unconnected!) changed = item.set(pin, false) || changed
        const queue = this.gates.map(g => g.item), pending = new Set(queue)
        for (let i = 0; i < queue.length; i++) {
            if (i >= maxEvents) { this.errors.push('circuit did not settle'); return changed }
            const gate = queue[i]; pending.delete(gate)
            changed = gate.update() || changed
            for (const c of this.fanout.get(gate) || []) if (c.to.set(c.toPin, Boolean(gate.get(c.fromPin)))) {
                changed = true
                if (!pending.has(c.to)) { pending.add(c.to); queue.push(c.to) }
            }
        }
        return changed
    }

    // Global step clock: no register may observe another register's new Q
    // while sampling its own D. Memory writes follow the same two-phase rule.
    tick() {
        this.update()
        if (this.errors.length) throw Error(this.errors.join('; '))
        for (const g of this.gates) g.item.sample()
        for (const g of this.gates) g.item.commit()
        this.cycles++
        this.update()
    }
    reset() { for (const g of this.gates) g.item.reset(); this.cycles = 0; this.update() }
    voltage(wire: Wire) { const d = this.wireDrivers.get(wire); return d ? Boolean(d.from.get(d.fromPin)) : undefined }
}
