import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const XORGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 Q0.66 1 0 2" fill="none" stroke="#999" strokeWidth={0.08} />
        <path d="M0.16 0 Q0.83 1 0.16 2 L1 2 Q1.91 2 2 1 Q1.91 0 1 0 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08} />
    </GateView>
}

export const XORGate = makeGate([2, 2], XORGateView, {
    'Y': { 'type': 'out', 'coord': [2, 1] },
    'A': { 'type': 'in', 'coord': [0, 0] },
    'B': { 'type': 'in', 'coord': [0, 2] }
}, (g) => g.set('Y', g.get('A') != g.get('B')))
