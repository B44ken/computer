import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const NOTGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 L1.75 1 L0 2 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08} />
        <path d="M1.75 1 L2 1" stroke="#999" strokeWidth={0.08} />
    </GateView>
}

export const NOTGate = makeGate("NOT", [2, 2], NOTGateView, {
    'Y': { 'type': 'out', 'coord': [2, 1], 'invert': true },
    'A': { 'type': 'in', 'coord': [0, 1] }
}, (g) => g.set('Y', !g.get('A')))
