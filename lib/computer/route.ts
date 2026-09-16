import { Bridge, Layout, Note, Placed, Point, Spec, Terminal, Trace, key } from './model'
import { technology } from './parts'

type Placement = { spec: Spec, cells: Placed[], terminals: Terminal[], notes: Note[] }
type Tree = { source: number, nodes: Set<number>, edges: Map<number, Set<number>> }

class Heap {
    a: [number, number][] = []
    push(v: [number, number]) {
        let i = this.a.length; this.a.push(v)
        while (i > 0) { const p = (i - 1) >> 1; if (this.a[p][0] <= v[0]) break; this.a[i] = this.a[p]; i = p }
        this.a[i] = v
    }
    pop() {
        const first = this.a[0], last = this.a.pop()!
        if (this.a.length) {
            let i = 0
            while (2 * i + 1 < this.a.length) {
                let j = 2 * i + 1
                if (j + 1 < this.a.length && this.a[j + 1][0] < this.a[j][0]) j++
                if (this.a[j][0] >= last[0]) break
                this.a[i] = this.a[j]; i = j
            }
            this.a[i] = last
        }
        return first
    }
}

// Grid pitch = half a gate unit. A crossing is a reserved 1x1 Cross device,
// not a graphical intersection which secretly keeps two net IDs separate.
export function route(p: Placement, margin = 14, priority: string[] = []): Layout {
    const shift = (n: number) => n + margin
    const cells = p.cells.map(c => ({ ...c, x: shift(c.x), y: shift(c.y) }))
    const terminals = p.terminals.map(t => ({ ...t, x: shift(t.x), y: shift(t.y) }))
    const notes = p.notes.map(n => ({ ...n, x: shift(n.x), y: shift(n.y) }))
    const W = Math.ceil(Math.max(...cells.map(c => c.x + technology[c.kind].width), ...terminals.map(t => t.x)) * 2 + margin * 2)
    const H = Math.ceil(Math.max(...cells.map(c => c.y + technology[c.kind].height), ...terminals.map(t => t.y)) * 2 + margin * 2)
    const count = W * H, blocked = new Uint8Array(count), owners = new Int32Array(count).fill(-1)
    const pinNet = new Map<number, number>(), names: string[] = [], index = new Map<string, number>()
    const nets: { source?: number, sinks: number[] }[] = []
    const stubs: { net: number, path: number[] }[] = []
    const nid = (net: string) => {
        if (!index.has(net)) { index.set(net, names.length); names.push(net); nets.push({ sinks: [] }) }
        return index.get(net)!
    }
    const at = (x: number, y: number) => Math.round(y * 2) * W + Math.round(x * 2)
    const xy = (n: number): Point => [n % W / 2, Math.floor(n / W) / 2]
    const addPin = (x: number, y: number, net: string, source: boolean) => {
        const n = at(x, y), id = nid(net)
        if (pinNet.has(n) && pinNet.get(n) !== id) throw Error(`pin collision at ${x},${y}`)
        pinNet.set(n, id)
        if (source) {
            if (nets[id].source !== undefined) throw Error(`multiple drivers of ${net}`)
            nets[id].source = n
        } else nets[id].sinks.push(n)
    }
    for (const c of cells) {
        const t = technology[c.kind]
        for (let y = c.y * 2; y <= (c.y + t.height) * 2; y++)
            for (let x = c.x * 2; x <= (c.x + t.width) * 2; x++) blocked[y * W + x] = 1
        for (const [name, pin] of Object.entries(t.pins)) {
            addPin(c.x + pin.x, c.y + pin.y, c.pins[name], pin.source)
            const n = at(c.x + pin.x, c.y + pin.y)
            const step = pin.source ? 1 : pin.x === 0 ? -1 : W
            stubs.push({ net: nid(c.pins[name]), path: [n, n + step, n + 2 * step] })
        }
    }
    for (const t of terminals) {
        addPin(t.x, t.y, t.net, t.source)
        const n = at(t.x, t.y), step = t.source ? 1 : -1
        stubs.push({ net: nid(t.net), path: [n, n + step, n + 2 * step] })
    }
    for (const [n, net] of pinNet) { blocked[n] = 0; owners[n] = net }
    // Reserve annotations too: wires must not run through the explanatory text.
    for (const note of notes) {
        for (let y = Math.floor((note.y - 1) * 2); y <= note.y * 2 + 1; y++)
            for (let x = Math.floor(note.x * 2); x < Math.min(W, (note.x + note.text.length * 0.46) * 2); x++)
                if (y >= 0 && y < H && !pinNet.has(y * W + x)) blocked[y * W + x] = 1
    }
    const trees: Tree[] = nets.map(n => {
        if (n.source === undefined) throw Error('net without driver')
        return { source: n.source, nodes: new Set([n.source]), edges: new Map() }
    })
    for (const stub of stubs) {
        const tree = trees[stub.net]
        for (let i = 0; i < stub.path.length; i++) {
            const n = stub.path[i]
            if (i && (blocked[n] || pinNet.has(n) && pinNet.get(n) !== stub.net)) throw Error('pin escape collision at ' + key(xy(n)))
            owners[n] = stub.net; pinNet.set(n, stub.net)
            if (!tree.edges.has(n)) tree.edges.set(n, new Set())
            if (i) { tree.edges.get(n)!.add(stub.path[i - 1]); tree.edges.get(stub.path[i - 1])!.add(n) }
        }
    }
    const grow = (tree: Tree, seeds: number[]) => {
        const queue = [...seeds]
        for (let i = 0; i < queue.length; i++) for (const n of tree.edges.get(queue[i]) || []) if (!tree.nodes.has(n)) {
            tree.nodes.add(n); queue.push(n)
        }
    }
    for (const tree of trees) grow(tree, [tree.source])
    const crossings: { center: number, h: number, v: number }[] = []
    const centers = new Set<number>()
    const deltas = [1, W, -1, -W]
    const validStep = (a: number, b: number, d: number, distance = 1) => b >= 0 && b < count &&
        (d % 2 ? Math.abs(Math.floor(a / W) - Math.floor(b / W)) === distance : Math.abs(a % W - b % W) === distance)
    const canUse = (n: number, net: number) => !blocked[n] && (owners[n] === -1 || owners[n] === net)
    const clearance = (n: number, net: number) => {
        if (owners[n] === net) return true
        const x = n % W, y = Math.floor(n / W)
        for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++)
            for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx++) {
                const other = owners[yy * W + xx]
                if (other >= 0 && other !== net) return false
            }
        return true
    }
    const nearCost = (n: number, net: number) => {
        if (owners[n] === net) return 0
        const x = n % W, y = Math.floor(n / W)
        let distance = 3
        for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++)
            for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx++)
                if (owners[yy * W + xx] >= 0 && owners[yy * W + xx] !== net)
                    distance = Math.min(distance, Math.max(Math.abs(xx - x), Math.abs(yy - y)))
        return distance === 1 ? 12 : distance === 2 ? 3 : 0
    }
    const bridgeRun = (from: number, d: number, net: number, banned: Set<number>) => {
        const delta = deltas[d], perp = d % 2 ? 1 : W
        let crossed = 0, last = -100
        for (let distance = 1; distance <= 160; distance++) {
            const center = from + distance * delta
            if (!validStep(from, center, d, distance) || blocked[center]) return null
            const old = owners[center]
            if (old >= 0 && old !== net) {
                if (banned.has(center) || distance - last < 3) return null
                const adjacent = trees[old].edges.get(center)
                if (adjacent?.size !== 2 || !adjacent.has(center - perp) || !adjacent.has(center + perp)) return null
                const cx = center % W, cy = Math.floor(center / W)
                for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
                    if (x < 0 || x >= W || y < 0 || y >= H) return null
                    const n = y * W + x
                    if (blocked[n] || pinNet.has(n)) return null
                    if (owners[n] >= 0 && !(owners[n] === old && (n === center || n === center - perp || n === center + perp))) return null
                }
                crossed++; last = distance
            }
            if (crossed && distance - last >= 3 && canUse(center, net) && clearance(center, net))
                return { end: center, cost: distance + 12 * crossed }
            if (!crossed && distance >= 3) return null
        }
        return null
    }
    const costs = new Float64Array(count * 5), previous = new Int32Array(count * 5)
    function search(start: number, net: number, banned: Set<number>): number[] | null {
        const tree = trees[net]
        if (tree.nodes.has(start)) return [start]
        let minx = W, miny = H, maxx = 0, maxy = 0
        for (const n of tree.nodes) if (!centers.has(n)) {
            const x = n % W, y = Math.floor(n / W)
            minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y)
        }
        const heuristic = (n: number) => Math.max(0, minx - n % W, n % W - maxx) + Math.max(0, miny - Math.floor(n / W), Math.floor(n / W) - maxy)
        costs.fill(Infinity); previous.fill(-1)
        const heap = new Heap(), first = start * 5 + 4
        costs[first] = 0; heap.push([heuristic(start), first])
        while (heap.a.length) {
            const [estimate, state] = heap.pop(), n = Math.floor(state / 5), dir = state % 5
            if (estimate > costs[state] + heuristic(n) + 1e-8) continue
            if (tree.nodes.has(n) && !centers.has(n)) {
                const path = [n]
                for (let s = state; previous[s] >= 0;) {
                    const before = previous[s], a = Math.floor(s / 5), b = Math.floor(before / 5)
                    const step = a > b ? (a - b >= W ? -W : -1) : (b - a >= W ? W : 1)
                    for (let v = a + step;; v += step) { path.push(v); if (v === b) break }
                    s = before
                }
                return path // existing tree -> new sink
            }
            for (let d = 0; d < 4; d++) {
                const end = n + deltas[d]
                const push = (dest: number, cost: number) => {
                    const next = dest * 5 + d, value = costs[state] + cost + (dir !== 4 && dir !== d ? 1.5 : 0)
                    if (value >= costs[next]) return
                    costs[next] = value; previous[next] = state; heap.push([value + heuristic(dest), next])
                }
                if (validStep(n, end, d) && canUse(end, net)) push(end, 1 + nearCost(end, net))
                const crossing = bridgeRun(n, d, net, banned)
                if (crossing) push(crossing.end, crossing.cost)
            }
        }
        return null
    }
    const span = (id: number) => {
        const ns = [nets[id].source!, ...nets[id].sinks], xs = ns.map(n => n % W), ys = ns.map(n => Math.floor(n / W))
        return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)
    }
    const rank = (id: number) => { const i = priority.indexOf(names[id]); return i < 0 ? 10000 + span(id) : i }
    const order = nets.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b)
    for (const net of order) {
        const tree = trees[net], source = xy(tree.source)
        const sinks = [...new Set(nets[net].sinks)].sort((a, b) => {
            const dist = (n: number) => Math.abs(xy(n)[0] - source[0]) + Math.abs(xy(n)[1] - source[1])
            return dist(a) - dist(b)
        })
        for (const sink of sinks) {
            const banned = new Set<number>()
            let path: number[] | null = null
            for (let tries = 0; tries < 120; tries++) {
                path = search(sink, net, banned)
                if (!path) throw Error(`unroutable ${names[net]} to ${key(xy(sink))} on ${W / 2}x${H / 2}`)
                const proposed = path.filter(n => owners[n] >= 0 && owners[n] !== net)
                let conflict = -1
                for (const c of proposed) {
                    const cx = c % W, cy = Math.floor(c / W)
                    for (const n of path) {
                        if (n === c) continue
                        const dx = Math.abs(n % W - cx), dy = Math.abs(Math.floor(n / W) - cy)
                        if (dx === 1 && dy === 1) conflict = c
                    }
                    for (const other of proposed) if (other !== c && Math.abs(other % W - cx) <= 2 && Math.abs(Math.floor(other / W) - cy) <= 2) conflict = c
                }
                if (conflict < 0) break
                banned.add(conflict); path = null
            }
            if (!path) throw Error(`unroutable ${names[net]} to ${key(xy(sink))}: crossover footprint`)
            for (let i = 0; i < path.length; i++) {
                const n = path[i]
                if (owners[n] >= 0 && owners[n] !== net) {
                    const old = owners[n], horizontal = Math.abs(path[i + 1] - n) === 1
                    crossings.push({ center: n, h: horizontal ? net : old, v: horizontal ? old : net }); centers.add(n)
                    const cx = n % W, cy = Math.floor(n / W)
                    blocked[n] = 1
                    for (const dx of [-1, 1]) for (const dy of [-1, 1]) blocked[(cy + dy) * W + cx + dx] = 1
                } else owners[n] = net
                tree.nodes.add(n)
                if (i) {
                    const prev = path[i - 1]
                    if (!tree.edges.has(n)) tree.edges.set(n, new Set())
                    if (!tree.edges.has(prev)) tree.edges.set(prev, new Set())
                    tree.edges.get(n)!.add(prev); tree.edges.get(prev)!.add(n)
                }
            }
            grow(tree, path)
        }
    }
    const parents = trees.map(tree => {
        const parent = new Map<number, number>([[tree.source, -1]]), queue = [tree.source]
        for (let i = 0; i < queue.length; i++) for (const n of tree.edges.get(queue[i]) || []) if (!parent.has(n)) {
            parent.set(n, queue[i]); queue.push(n)
        }
        return parent
    })
    const bridges: Bridge[] = crossings.map((c, i) => ({ id: `cross.${i}`, center: xy(c.center), hNet: names[c.h], vNet: names[c.v],
        hForward: parents[c.h].get(c.center)! < c.center, vForward: parents[c.v].get(c.center)! < c.center }))
    const traces: Trace[] = []
    for (let id = 0; id < trees.length; id++) {
        const edges = trees[id].edges
        // A bridge replaces both through-paths. Neither net remains wired
        // straight through its centre: simulation goes through the Cross pins.
        for (const c of crossings) if (c.h === id || c.v === id) {
            for (const v of edges.get(c.center) || []) edges.get(v)!.delete(c.center)
            edges.delete(c.center)
        }
        const seen = new Set<string>(), edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`
        const stops = (n: number) => edges.get(n)!.size !== 2 || pinNet.has(n)
        const starts = [...edges.keys()].sort((a, b) => Number(stops(b)) - Number(stops(a)))
        for (const a of starts) for (const b of edges.get(a) || []) {
            if (seen.has(edgeKey(a, b))) continue
            const path = [a, b]; seen.add(edgeKey(a, b))
            let prev = a, n = b
            while (!stops(n)) {
                const next = [...edges.get(n)!].find(v => v !== prev)!
                if (seen.has(edgeKey(n, next))) break
                seen.add(edgeKey(n, next)); path.push(next); prev = n; n = next
            }
            const points = path.map(xy).filter((pt, i, arr) => i === 0 || i === arr.length - 1 ||
                !(arr[i - 1][0] === pt[0] && pt[0] === arr[i + 1][0] || arr[i - 1][1] === pt[1] && pt[1] === arr[i + 1][1]))
            traces.push({ net: names[id], points })
        }
    }
    const all: Point[] = [
        ...cells.flatMap(c => [[c.x, c.y], [c.x + technology[c.kind].width, c.y + technology[c.kind].height]] as Point[]),
        ...terminals.map(t => [t.x, t.y] as Point), ...traces.flatMap(t => t.points),
        ...notes.flatMap(n => [[n.x, n.y - 1], [n.x + n.text.length * 0.46, n.y + 1]] as Point[])
    ]
    const minX = Math.floor(Math.min(...all.map(p => p[0]))) - 2, minY = Math.floor(Math.min(...all.map(p => p[1]))) - 2
    const width = Math.ceil(Math.max(...all.map(p => p[0]))) - minX + 2, height = Math.ceil(Math.max(...all.map(p => p[1]))) - minY + 2
    cells.forEach(c => { c.x -= minX; c.y -= minY })
    terminals.forEach(t => { t.x -= minX; t.y -= minY })
    notes.forEach(n => { n.x -= minX; n.y -= minY })
    traces.forEach(t => t.points.forEach(pt => { pt[0] -= minX; pt[1] -= minY }))
    bridges.forEach(b => { b.center[0] -= minX; b.center[1] -= minY })
    return { ...p, cells, terminals, notes, bridges, traces, width, height }
}
