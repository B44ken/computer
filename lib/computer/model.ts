export const kinds = ['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'MUX', 'NOT', 'DFF'] as const
export type Kind = typeof kinds[number]
export type Point = [number, number]
export type Cell = { id: string, kind: Kind, pins: Record<string, string>, initial?: boolean, label?: string }
export type Port = { name: string, direction: 'input' | 'output', bits: string[] }
export type Spec = { name: string, cells: Cell[], ports: Port[] }
export type Placed = Cell & { x: number, y: number }
export type Terminal = { id: string, net: string, source: boolean, x: number, y: number }
export type Trace = { net: string, points: Point[] }
export type Bridge = { id: string, center: Point, hNet: string, vNet: string, hForward: boolean, vForward: boolean }
export type Note = { x: number, y: number, text: string }
export type Layout = { spec: Spec, cells: Placed[], terminals: Terminal[], traces: Trace[], bridges: Bridge[], notes: Note[], width: number, height: number }
export const key = ([x, y]: Point) => `${x},${y}`
export const unkey = (s: string): Point => s.split(',').map(Number) as Point
export const bit = (name: string, i: number) => `${name}[${i}]`
export function terminals(spec: Spec): Terminal[] {
    const result = spec.ports.filter(p => p.name !== 'clk').flatMap(p => p.bits.map((net, i) => ({
        id: bit(p.name, i), net, source: p.direction === 'input', x: 0, y: 0
    })))
    for (const net of ['0', '1']) if (spec.cells.some(c => Object.values(c.pins).includes(net)))
        result.push({ id: net, net, source: true, x: 0, y: 0 })
    return result
}
