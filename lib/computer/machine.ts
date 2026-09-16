import { Gate } from '../../components/gates/core/Gate'
import { DFFGate } from '../../components/gates/DFFGate'
import { Wire } from '../../components/gates/core/Wire'
import { Circuit } from '../circuit'
import { part, crossPart, technology } from './parts'
import { Layout, Point, key } from './model'
import { MemoryInterface } from './memory'

type PinRef = { gate: Gate, pin: string, net: string }
type Connection = { from: Gate, fromPin: string, to: Gate, toPin: string }
export type Snapshot = { pc: number, a: number, inst: number, operand: number, address: number, we: boolean }
export type Step = Snapshot & { cycle: number, nextPc: number, nextA: number, write: { address: number, value: number } | null }

class Union {
    parent = new Map<string, string>()
    root(s: string): string {
        if (!this.parent.has(s)) this.parent.set(s, s)
        const p = this.parent.get(s)!
        if (p === s) return s
        const r = this.root(p); this.parent.set(s, r); return r
    }
    join(a: string, b: string) { const ra = this.root(a), rb = this.root(b); if (ra !== rb) this.parent.set(ra, rb) }
}

export function tracePoints(points: Point[]) {
    const result: Point[] = []
    for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1], [bx, by] = points[i]
        if (ax !== bx && ay !== by) throw Error('non-orthogonal trace')
        const steps = Math.round((Math.abs(bx - ax) + Math.abs(by - ay)) * 2)
        if (!steps) continue
        for (let j = 0; j <= steps; j++) result.push([ax + (bx - ax) * j / steps, ay + (by - ay) * j / steps])
    }
    return result
}

export class GateComputer {
    circuit = new Circuit()
    memory: MemoryInterface
    parts = new Map<string, Gate>()
    flipflops: DFFGate[] = []
    connections: Connection[] = []
    fanout = new Map<Gate, Connection[]>()
    cycles = 0
    wireDrivers: { gate: Gate, pin: string }[] = []

    constructor(public layout: Layout) {
        for (const c of layout.cells) {
            const g = part(c)
            for (const p in g.pins) if (p !== 'Q') g.set(p, false)
            this.parts.set(c.id, g); this.circuit.add(g, [c.x, c.y])
            if (g instanceof DFFGate) this.flipflops.push(g)
        }
        for (const b of layout.bridges) {
            const g = crossPart(b)
            for (const p in g.pins) g.set(p, false)
            this.parts.set(b.id, g); this.circuit.add(g, [b.center[0] - 0.5, b.center[1] - 0.5])
        }
        this.memory = new MemoryInterface(layout.terminals)
        this.parts.set('memory', this.memory); this.circuit.add(this.memory)
        for (const trace of layout.traces) this.circuit.add(new Wire(trace.points))
        this.connectGeometry()
        this.reset(new Uint8Array(64))
    }

    // Connectivity is reconstructed from the routed coordinates, NOT from
    // the original logical netlist. A bad route cannot be hidden by the UI.
    private connectGeometry() {
        const union = new Union(), occupied = new Map<string, string>()
        const claim = (point: Point, net: string) => {
            const k = key(point), old = occupied.get(k)
            if (old !== undefined && old !== net) throw Error(`short between ${old} and ${net} at ${k}`)
            occupied.set(k, net); union.root(k); return k
        }
        for (const t of this.layout.traces) {
            const ps = tracePoints(t.points)
            for (const p of ps) claim(p, t.net)
            for (let i = 1; i < ps.length; i++) union.join(key(ps[i - 1]), key(ps[i]))
        }
        const pins: { position: string, ref: PinRef }[] = []
        const add = (g: Gate, p: string, x: number, y: number, net: string) => {
            pins.push({ position: claim([x, y], net), ref: { gate: g, pin: p, net } })
        }
        for (const c of this.layout.cells) {
            const g = this.parts.get(c.id)!
            for (const [p, info] of Object.entries(technology[c.kind].pins)) add(g, p, c.x + info.x, c.y + info.y, c.pins[p])
        }
        for (const b of this.layout.bridges) {
            const g = this.parts.get(b.id)!
            for (const [p, info] of Object.entries(g.pins)) add(g, p,
                b.center[0] - 0.5 + info.coord.x, b.center[1] - 0.5 + info.coord.y,
                p === 'TL' || p === 'BR' ? b.hNet : b.vNet)
        }
        for (const t of this.layout.terminals) add(this.memory, t.id, t.x, t.y, t.net)
        const groups = new Map<string, PinRef[]>()
        for (const p of pins) {
            const root = union.root(p.position)
            if (!groups.has(root)) groups.set(root, [])
            groups.get(root)!.push(p.ref)
        }
        const drivers = new Map<string, PinRef>()
        for (const [root, ps] of groups) {
            const outs = ps.filter(p => p.gate.pins[p.pin].type === 'out')
            if (outs.length !== 1) throw Error(`${outs.length} drivers at ${root}: ${ps.map(p => `${p.gate.name}.${p.pin}`)}`)
            drivers.set(root, outs[0])
            for (const p of ps) if (p.gate.pins[p.pin].type === 'in') {
                if (p.net !== outs[0].net) throw Error('pin connected to wrong net')
                this.connections.push({ from: outs[0].gate, fromPin: outs[0].pin, to: p.gate, toPin: p.pin })
            }
        }
        this.wireDrivers = this.layout.traces.map(t => {
            const driver = drivers.get(union.root(key(t.points[0])))
            if (!driver) throw Error('disconnected wire fragment')
            return driver
        })
        for (const c of this.connections) {
            if (!this.fanout.has(c.from)) this.fanout.set(c.from, [])
            this.fanout.get(c.from)!.push(c)
        }
        // Expose the real Circuit as well, for the existing simulator tooling.
        this.circuit.connections = this.connections.map(c => ({ ...c, via: this.circuit.wires[0]?.item }))
        this.circuit.unconnected = []
    }

    settle() {
        const queue = [...this.parts.values()], pending = new Set(queue)
        for (let i = 0; i < queue.length; i++) {
            if (i > 1000000) throw Error('combinational circuit did not settle')
            const g = queue[i]; pending.delete(g); g.update()
            for (const c of this.fanout.get(g) || []) if (c.to.set(c.toPin, Boolean(g.get(c.fromPin))) && !pending.has(c.to)) {
                queue.push(c.to); pending.add(c.to)
            }
        }
    }
    snapshot(): Snapshot {
        const m = this.memory
        return { pc: m.readBus('out_pc', 6), a: m.readBus('out_mem', 8), inst: m.readBus('inst', 8),
            operand: m.readBus('in_mem', 8), address: m.readBus('out_adr', 6), we: Boolean(m.get('we[0]')) }
    }
    reset(image: ArrayLike<number>) {
        if (image.length > 64) throw Error('memory image exceeds 64 bytes')
        this.memory.bytes.fill(0); this.memory.bytes.set(Array.from(image))
        this.flipflops.forEach(g => g.reset()); this.cycles = 0; this.settle()
    }
    step(): Step {
        this.settle()
        const before = this.snapshot()
        this.flipflops.forEach(g => g.sample())
        const write = this.memory.store()
        this.flipflops.forEach(g => g.commit())
        this.cycles++; this.settle()
        const after = this.snapshot()
        return { ...before, cycle: this.cycles, nextPc: after.pc, nextA: after.a, write }
    }
}
