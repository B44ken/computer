import { Layout, Point, key, kinds } from './model'
import { technology, crossPart } from './parts'
import { GateComputer, tracePoints } from './machine'

export function audit(layout: Layout) {
    const bodies = layout.cells.map(c => ({ id: c.id, x: c.x, y: c.y, w: technology[c.kind].width, h: technology[c.kind].height,
        pins: new Set(Object.values(technology[c.kind].pins).map(p => key([c.x + p.x, c.y + p.y]))) }))
    for (const b of layout.bridges) {
        const g = crossPart(b), x = b.center[0] - 0.5, y = b.center[1] - 0.5
        bodies.push({ id: b.id, x, y, w: 1, h: 1, pins: new Set(Object.values(g.pins).map(p => key([x + p.coord.x, y + p.coord.y]))) })
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j]
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) throw Error(`body overlap ${a.id} / ${b.id}`)
    }
    const onGrid = (p: Point) => {
        if (p.some(n => !Number.isFinite(n) || n * 2 !== Math.round(n * 2)) || p[0] < 0 || p[1] < 0 || p[0] > layout.width || p[1] > layout.height) throw Error('off-grid/out-of-bounds geometry')
    }
    let length = 0
    for (const trace of layout.traces) {
        trace.points.forEach(onGrid)
        for (let i = 1; i < trace.points.length; i++) length += Math.abs(trace.points[i][0] - trace.points[i - 1][0]) + Math.abs(trace.points[i][1] - trace.points[i - 1][1])
        for (const p of tracePoints(trace.points)) for (const b of bodies) {
            if (p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h && !b.pins.has(key(p))) throw Error(`wire intersects ${b.id} at ${key(p)}`)
        }
    }
    for (const b of bodies) { onGrid([b.x, b.y]); onGrid([b.x + b.w, b.y + b.h]) }
    if (layout.cells.some(c => !kinds.includes(c.kind))) throw Error('non-primitive CPU component')
    const machine = new GateComputer(layout) // checks all physical nets, pins and drivers
    if (machine.flipflops.length !== 14) throw Error('CPU must contain exactly 14 state bits')
    return { primitives: layout.cells.length, dffs: machine.flipflops.length, crossovers: layout.bridges.length,
        width: layout.width, height: layout.height, area: layout.width * layout.height, wireLength: length,
        wireFragments: layout.traces.length, errors: 0 }
}
