import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const ANDGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 L1 0 A1 1 0 0 1 1 2 L0 2 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08} />
    </GateView>
}

export const ANDGate = makeGate([2, 2], ANDGateView, {
    'Y': { 'type': 'out', 'coord': [2, 1] },
    'A': { 'type': 'in', 'coord': [0, 0] },
    'B': { 'type': 'in', 'coord': [0, 2] }
}, (g) => g.set('Y', g.get('A') && g.get('B')))