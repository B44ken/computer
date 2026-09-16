import { ANDGate } from '../../components/gates/ANDGate'
import { NANDGate } from '../../components/gates/NANDGate'
import { ORGate } from '../../components/gates/ORGate'
import { NORGate } from '../../components/gates/NORGate'
import { XORGate } from '../../components/gates/XORGate'
import { XNORGate } from '../../components/gates/XNORGate'
import { NOTGate } from '../../components/gates/NOTGate'
import { MUXGate } from '../../components/gates/MUXGate'
import { DFFGate } from '../../components/gates/DFFGate'
import { Cross } from '../../components/gates/Cross'
import { Gate } from '../../components/gates/core/Gate'
import { Bridge, Cell, Kind } from './model'

export const factories = { AND: ANDGate, NAND: NANDGate, OR: ORGate, NOR: NORGate, XOR: XORGate, XNOR: XNORGate, NOT: NOTGate, MUX: MUXGate, DFF: DFFGate }
export const part = (c: Cell): Gate => c.kind === 'DFF' ? new DFFGate(c.id, c.initial) : new factories[c.kind](c.id)
export const technology = Object.fromEntries(Object.entries(factories).map(([kind, F]) => {
    const g = new F()
    return [kind, { width: g.size.x, height: g.size.y, pins: Object.fromEntries(Object.entries(g.pins).filter(([p]) => p !== 'C').map(([p, v]) => [p, { x: v.coord.x, y: v.coord.y, source: v.type === 'out' }])) }]
})) as Record<Kind, { width: number, height: number, pins: Record<string, { x: number, y: number, source: boolean }> }>

// Native Cross instances keep their original size, view, and corner pins.
// Only the placed orientation changes (quarter turns, supported by Circuit).
export const crossPart = (b: Bridge): Gate => new Cross(b.id)
export const crossRotation = (b: Bridge) => b.hForward ? b.vForward ? 0 : 3 : b.vForward ? 1 : 2
export const crossNet = (b: Bridge, pin: string) =>
    (pin === 'TL' || pin === 'BR') === !(crossRotation(b) & 1) ? b.hNet : b.vNet
