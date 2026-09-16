import { Gate } from '../components/gates/core/Gate'
import { Coord, coord } from './coord'

// Rotation belongs to the placed instance, never to the gate definition.
export function localPoint(gate: Gate, point: Coord, rotation = 0) {
    const { x, y } = point, { x: w, y: h } = gate.size
    return [coord([x, y]), coord([h - y, x]), coord([w - x, h - y]), coord([y, w - x])][rotation & 3]
}
export const placedSize = (gate: Gate, rotation = 0) => rotation & 1 ? coord([gate.size.y, gate.size.x]) : gate.size
