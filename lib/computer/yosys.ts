import { Cell, Kind, Spec, kinds } from './model'

type Bit = number | string
type Module = {
    ports: Record<string, { direction: 'input' | 'output', bits: Bit[] }>,
    cells: Record<string, { type: string, connections: Record<string, Bit[]> }>,
    netnames: Record<string, { bits: Bit[], attributes?: { init?: string } }>
}
const net = (b: Bit) => typeof b === 'number' ? `n${b}` : b

export function fromYosys(json: { modules: Record<string, Module> }, top = 'stupid'): Spec {
    const m = json.modules[top]
    if (!m) throw Error(`missing module ${top}`)
    const initial = new Map<string, boolean>()
    for (const n of Object.values(m.netnames)) if (n.attributes?.init) {
        const values = n.attributes.init.split('').reverse()
        n.bits.forEach((b, i) => {
            if (values[i] === '0' || values[i] === '1') initial.set(net(b), values[i] === '1')
        })
    }
    const clock = net(m.ports.clk.bits[0])
    const cells: Cell[] = Object.entries(m.cells).map(([id, cell]) => {
        const kind = (cell.type === '$_DFF_P_' ? 'DFF' : cell.type.replace(/^\$_|_$/g, '')) as Kind
        if (!kinds.includes(kind)) throw Error(`unsupported cell ${cell.type}: ${id}`)
        const pins = Object.fromEntries(Object.entries(cell.connections).map(([p, bits]) => {
            if (bits.length !== 1) throw Error(`non-bit-level port ${id}.${p}`)
            const signal = net(bits[0])
            if (signal === 'x' || signal === 'z') throw Error(`undefined input ${id}.${p}`)
            return [p, signal]
        }))
        if (kind === 'DFF' && pins.C !== clock) throw Error('only one shared rising-edge clock is supported')
        if (kind === 'DFF' && !initial.has(pins.Q)) throw Error(`missing initial state for ${id}`)
        return { id, kind, pins, ...(kind === 'DFF' ? { initial: initial.get(pins.Q) } : {}) }
    })
    return { name: 'yosys', cells, ports: Object.entries(m.ports).map(([name, p]) => ({ name, direction: p.direction, bits: p.bits.map(net) })) }
}
