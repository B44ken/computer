import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const NORGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 Q0.66 1 0 2 L0.83 2 Q1.66 2 1.75 1 Q1.66 0 0.83 0 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08} />
        <path d="M1.75 1 L2 1" stroke="#999" strokeWidth={0.08} />
    </GateView>
}

export const NORGate = makeGate([2, 2], NORGateView, {
    'Y': { 'type': 'out', 'coord': [2, 1], 'invert': true },
    'A': { 'type': 'in', 'coord': [0, 0] },
    'B': { 'type': 'in', 'coord': [0, 2] }
}, (g) => g.set('Y', !(g.get('A') || g.get('B'))))