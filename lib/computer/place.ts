import ELK from 'elkjs/lib/elk.bundled.js'
import { Spec, terminals } from './model'
import { technology } from './parts'

export async function autoPlace(spec: Spec, seed = 1) {
    const ts = terminals(spec), drivers = new Map<string, string>()
    const cells = spec.cells
    const nodes: any[] = cells.map(c => {
        const tech = technology[c.kind]
        return {
            id: c.id, width: tech.width, height: tech.height,
            layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
            ports: Object.entries(tech.pins).map(([pin, p]) => {
                const id = `${c.id}:${pin}`
                if (p.source) drivers.set(c.pins[pin], id)
                return { id, x: p.x, y: p.y, width: 0, height: 0,
                    layoutOptions: { 'elk.port.side': p.source ? 'EAST' : p.y === tech.height && p.x > 0 ? 'SOUTH' : 'WEST' } }
            })
        }
    })
    for (const t of ts) {
        if (t.id.startsWith('out_adr')) continue
        if (t.source) drivers.set(t.net, t.id + ':p')
        nodes.push({ id: t.id, width: 0, height: 0,
            layoutOptions: { 'elk.portConstraints': 'FIXED_POS', ...(t.source ? { 'elk.layered.layering.layerConstraint': 'FIRST' } : {}) },
            ports: [{ id: t.id + ':p', x: 0, y: 0, width: 0, height: 0, layoutOptions: { 'elk.port.side': t.source ? 'EAST' : 'WEST' } }] })
    }
    const edges: any[] = []
    const connect = (signal: string, target: string) => {
        const source = drivers.get(signal)
        if (!source) throw Error('undriven net ' + signal)
        edges.push({ id: `e${edges.length}`, sources: [source], targets: [target] })
    }
    for (const c of cells) for (const [p, info] of Object.entries(technology[c.kind].pins))
        if (!info.source) connect(c.pins[p], `${c.id}:${p}`)
    for (const t of ts) if (!t.source && !t.id.startsWith('out_adr')) connect(t.net, t.id + ':p')
    const graph = await new ELK().layout({ id: 'cpu', children: nodes, edges, layoutOptions: {
        'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
        'elk.randomSeed': String(seed), 'elk.spacing.nodeNode': '3',
        'elk.layered.spacing.nodeNodeBetweenLayers': '5', 'elk.spacing.edgeNode': '1',
        'elk.layered.spacing.edgeNodeBetweenLayers': '1.5', 'elk.spacing.edgeEdge': '0.5',
        'elk.layered.spacing.edgeEdgeBetweenLayers': '0.5',
        'elk.spacing.portPort': '0.5', 'elk.layered.mergeEdges': 'true', 'elk.padding': '[top=8,left=8,bottom=8,right=8]'
    } })
    // Seed a compact fixed-pitch array from ELK's layered ordering, then
    // anneal swaps (including empty slots) to reduce physical net span.
    const order = [...graph.children!].filter(n => cells.some(c => c.id === n.id)).sort((a, b) => a.x! - b.x! || a.y! - b.y!).map(n => n.id)
    const columns = 12, rows = Math.ceil(cells.length / columns), pitchX = 14, pitchY = 12
    const places = Array.from({ length: columns * rows }, (_, i) => ({ x: 14 + Math.floor(i / rows) * pitchX, y: 10 + (i % rows) * pitchY }))
    const occupants = places.map((_, i) => order[i] || '')
    const slot = new Map(occupants.filter(Boolean).map((id, i) => [id, i]))
    const left = ts.filter(t => t.source), right = ts.filter(t => !t.source && !t.id.startsWith('out_adr'))
    left.forEach((t, i) => { t.x = 2; t.y = 10 + i * 7 })
    right.forEach((t, i) => { t.x = 24 + columns * pitchX; t.y = 10 + i * 7 })
    for (const t of ts.filter(t => t.id.startsWith('out_adr'))) {
        const source = ts.find(p => p.id === t.id.replace('out_adr', 'inst'))!
        t.x = source.x; t.y = source.y
    }
    type End = { cell?: string, x: number, y: number }
    const nets = new Map<string, End[]>(), add = (net: string, p: End) => { if (!nets.has(net)) nets.set(net, []); nets.get(net)!.push(p) }
    for (const c of cells) for (const [name, pin] of Object.entries(technology[c.kind].pins)) add(c.pins[name], { cell: c.id, x: pin.x, y: pin.y })
    ts.forEach(t => add(t.net, { x: t.x, y: t.y }))
    const list = [...nets.values()], incident = new Map(cells.map(c => [c.id, new Set<number>()]))
    list.forEach((net, i) => net.forEach(p => { if (p.cell) incident.get(p.cell)!.add(i) }))
    const cost = (i: number) => {
        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
        for (const p of list[i]) {
            const base = p.cell ? places[slot.get(p.cell)!] : { x: 0, y: 0 }
            const x = base.x + p.x, y = base.y + p.y
            minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y)
        }
        return maxx - minx + maxy - miny
    }
    let random = seed || 1
    const rand = () => { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return (random >>> 0) / 4294967296 }
    let total = list.reduce((n, _, i) => n + cost(i), 0), best = total, bestOrder = [...occupants]
    for (let i = 0; i < 100000; i++) {
        const a = Math.floor(rand() * places.length), b = Math.floor(rand() * places.length)
        if (a === b || !occupants[a] && !occupants[b]) continue
        const u = occupants[a], v = occupants[b], affected = new Set([...(incident.get(u) || []), ...(incident.get(v) || [])])
        let before = 0; affected.forEach(n => { before += cost(n) })
        if (u) slot.set(u, b); if (v) slot.set(v, a)
        let after = 0; affected.forEach(n => { after += cost(n) })
        const temperature = 15 * Math.pow(0.02, i / 100000)
        if (after < before || rand() < Math.exp((before - after) / temperature)) {
            occupants[a] = v; occupants[b] = u; total += after - before
            if (total < best) { best = total; bestOrder = [...occupants] }
        } else { if (u) slot.set(u, a); if (v) slot.set(v, b) }
    }
    bestOrder.forEach((id, i) => { if (id) slot.set(id, i) })
    const placed = cells.map(c => ({ ...c, ...places[slot.get(c.id)!] }))
    return { spec, cells: placed, terminals: ts, notes: [{ x: 2, y: 5, text: 'yosys gates · elk-seeded placement + wire-length annealing · explicit Cross routing' }] }
}
