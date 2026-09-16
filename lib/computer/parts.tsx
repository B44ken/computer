import { ANDGate } from '../../components/gates/ANDGate'
import { NANDGate } from '../../components/gates/NANDGate'
import { ORGate } from '../../components/gates/ORGate'
import { NORGate } from '../../components/gates/NORGate'
import { XORGate } from '../../components/gates/XORGate'
import { XNORGate } from '../../components/gates/XNORGate'
import { NOTGate } from '../../components/gates/NOTGate'
import { MUXGate } from '../../components/gates/MUXGate'
import { DFFGate } from '../../components/gates/DFFGate'
import { Cross, CrossView } from '../../components/gates/Cross'
import { Gate } from '../../components/gates/core/Gate'
import { coord } from '../coord'
import { Bridge, Cell, Kind } from './model'

export const factories = { AND: ANDGate, NAND: NANDGate, OR: ORGate, NOR: NORGate, XOR: XORGate, XNOR: XNORGate, NOT: NOTGate, MUX: MUXGate, DFF: DFFGate }
export const part = (c: Cell): Gate => c.kind === 'DFF' ? new DFFGate(c.id, c.initial) : new factories[c.kind](c.id)
export const technology = Object.fromEntries(Object.entries(factories).map(([kind, F]) => {
    const g = new F()
    return [kind, { width: g.size.x, height: g.size.y, pins: Object.fromEntries(Object.entries(g.pins).filter(([p]) => p !== 'C').map(([p, v]) => [p, { x: v.coord.x, y: v.coord.y, source: v.type === 'out' }])) }]
})) as Record<Kind, { width: number, height: number, pins: Record<string, { x: number, y: number, source: boolean }> }>

// Same Cross component and TL->BR / TR->BL semantics, transformed into a
// diamond so its four terminals land on orthogonal half-grid tracks.
export function crossPart(b: Bridge): Gate {
    const g = new Cross(b.id), original = new Cross(b.id)
    const left = b.hForward ? 0 : 1, top = b.vForward ? 0 : 1
    const positions = { TL: [left, 0.5], BR: [1 - left, 0.5], TR: [0.5, top], BL: [0.5, 1 - top] }
    g.size = coord([1, 1])
    for (const p in positions) g.pins[p].coord = coord(positions[p] as [number, number])
    const a = 0.5 - left, bb = top - 0.5, c = 0.5 - left, d = 0.5 - top
    g.view = props => {
        for (const p in g.pins) original.pins[p].voltage = g.pins[p].voltage
        return <g transform={`scale(${props.width}) matrix(${a},${bb},${c},${d},${left},0.5)`}>
            <CrossView {...props} gate={original} width={1} height={1}/>
        </g>
    }
    return g
}
