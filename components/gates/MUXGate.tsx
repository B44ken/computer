import { GateView, makeGate } from './core/Gate'
import { GateViewProps } from './core/types'
export const MUXGateView = (props: GateViewProps) => <GateView {...props}>
    <path d="M0 0 L3 1 L3 3 L0 4 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08}/>
    <path d="M1.5 3.5 L1.5 4" stroke="#999" strokeWidth={0.08}/>
    <text x={1} y={1.7} fill="#999" fontSize={0.6}>0</text>
    <text x={1} y={3.1} fill="#999" fontSize={0.6}>1</text>
</GateView>
export const MUXGate = makeGate('MUX', [3, 4], MUXGateView, {
    A: { type: 'in', coord: [0, 0] }, B: { type: 'in', coord: [0, 4] },
    S: { type: 'in', coord: [1.5, 4] }, Y: { type: 'out', coord: [3, 2] }
}, g => g.set('Y', Boolean(g.get(g.get('S') ? 'B' : 'A'))))
