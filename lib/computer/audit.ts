import { Layout, Point, key, kinds } from './model'
import { technology, crossPart, crossRotation, crossNet } from './parts'
import { localPoint } from '../placement'
import { MemoryGate } from '../../components/gates/MemoryGate'
import { loadComputer } from './load'
import { DFFGate } from '../../components/gates/DFFGate'

export function tracePoints(points: Point[]) {
    const result: Point[] = []
    for (let i = 1; i < points.length; i++) {
        const [x, y] = points[i - 1], [xx, yy] = points[i]
        if (x !== xx && y !== yy) throw Error('non-orthogonal wire')
        const n = Math.round((Math.abs(xx - x) + Math.abs(yy - y)) * 2)
        for (let k = 0; k <= n; k++) result.push([x + (xx - x) * k / (n || 1), y + (yy - y) * k / (n || 1)])
    }
    return result
}

export function audit(layout: Layout) {
    const bodies = layout.cells.map(c => ({ id: c.id, x: c.x, y: c.y, w: technology[c.kind].width, h: technology[c.kind].height,
        pins: new Set(Object.values(technology[c.kind].pins).map(p => key([c.x + p.x, c.y + p.y]))) }))
    for (const b of layout.bridges) {
        const g = crossPart(b), x = b.center[0] - 0.5, y = b.center[1] - 0.5
        bodies.push({ id: b.id, x, y, w: 1, h: 1, pins: new Set(Object.values(g.pins).map(p => { const c = localPoint(g, p.coord, crossRotation(b)); return key([x + c.x, y + c.y]) })) })
    }
    const memory = new MemoryGate(layout.terminals.filter(t => t.id === '0' || t.id === '1').map(t => t.id))
    bodies.push({ id: 'memory', x: layout.memory.x, y: layout.memory.y, w: memory.size.x, h: memory.size.y,
        pins: new Set(Object.values(memory.pins).map(p => key([layout.memory.x + p.coord.x, layout.memory.y + p.coord.y]))) })
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j]
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) throw Error(`body overlap ${a.id} / ${b.id}`)
    }
    const onGrid = (p: Point) => {
        if (p.some(n => !Number.isFinite(n) || n * 2 !== Math.round(n * 2)) || p[0] < 0 || p[1] < 0 || p[0] > layout.width || p[1] > layout.height) throw Error('off-grid/out-of-bounds geometry')
    }
    let length = 0
    const occupied = new Map<string, string>()
    const claim = (p: Point, net: string) => {
        const k = key(p), old = occupied.get(k)
        if (old !== undefined && old !== net) throw Error(`unbridged crossing/short at ${k}: ${old} / ${net}`)
        occupied.set(k, net)
    }
    for (const c of layout.cells) for (const [pin, p] of Object.entries(technology[c.kind].pins)) claim([c.x + p.x, c.y + p.y], c.pins[pin])
    for (const b of layout.bridges) {
        const g = crossPart(b)
        for (const [pin, p] of Object.entries(g.pins)) {
            const q = localPoint(g, p.coord, crossRotation(b))
            claim([b.center[0] - 0.5 + q.x, b.center[1] - 0.5 + q.y], crossNet(b, pin))
        }
    }
    for (const t of layout.terminals) claim([t.x, t.y], t.net)
    for (const trace of layout.traces) {
        trace.points.forEach(onGrid)
        for (const p of tracePoints(trace.points)) claim(p, trace.net)
        for (let i = 1; i < trace.points.length; i++) length += Math.abs(trace.points[i][0] - trace.points[i - 1][0]) + Math.abs(trace.points[i][1] - trace.points[i - 1][1])
        for (const p of tracePoints(trace.points)) for (const b of bodies) {
            if (p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h && !b.pins.has(key(p)) && !(b.id.startsWith('cross.') && (p[0] === b.x || p[0] === b.x + b.w || p[1] === b.y || p[1] === b.y + b.h))) throw Error(`wire intersects ${b.id} at ${key(p)}`)
        }
    }
    for (const b of bodies) { onGrid([b.x, b.y]); onGrid([b.x + b.w, b.y + b.h]) }
    if (layout.cells.some(c => !kinds.includes(c.kind))) throw Error('non-primitive CPU component')
    const { circuit } = loadComputer(layout) // uses Circuit's native connectivity builder
    const expectedNet = (id: string, pin: string) => {
        if (id === 'memory') return layout.terminals.find(t => t.id === pin)!.net
        const cell = layout.cells.find(c => c.id === id)
        return cell ? cell.pins[pin] : crossNet(layout.bridges.find(b => b.id === id)!, pin)
    }
    for (const c of circuit.connections!) if (expectedNet(c.from.name, c.fromPin) !== expectedNet(c.to.name, c.toPin)) throw Error('physically connected wrong pins')
    const dffs = circuit.gates.filter(g => g.item instanceof DFFGate).length
    if (dffs !== 14) throw Error('CPU must contain exactly 14 state bits')
    return { primitives: layout.cells.length, dffs, crossovers: layout.bridges.length,
        width: layout.width, height: layout.height, area: layout.width * layout.height, wireLength: length,
        wireFragments: layout.traces.length, errors: 0 }
}
