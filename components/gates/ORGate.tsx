import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const ORGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 Q0.66 1 0 2 L0.83 2 Q1.75 2 2 1 Q1.75 0 0.83 0 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08} />
    </GateView>
}

export const ORGate = makeGate("OR", [2, 2], ORGateView, {
    'Y': { 'type': 'out', 'coord': [2, 1] },
    'A': { 'type': 'in', 'coord': [0, 0] },
    'B': { 'type': 'in', 'coord': [0, 2] }
}, (g) => g.set('Y', g.get('A') || g.get('B')))
