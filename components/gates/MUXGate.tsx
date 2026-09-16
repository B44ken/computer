import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const MUXGateView = (props: GateViewProps) => <GateView {...props}>
    <path d="M0 0 L1.8 .5 V1.5 L0 2 Z M1.8 1 H2 M1 1.72 V2" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08} />
    <text x={0.65} y={1.2} fill="#aaa" fontSize={0.55}>m</text>
</GateView>

export const MUXGate = makeGate("MUX", [2, 2], MUXGateView, {
    Y: { type: 'out', coord: [2, 1] },
    A: { type: 'in', coord: [0, 0] },
    B: { type: 'in', coord: [0, 2] },
    S: { type: 'in', coord: [1, 2] }
}, g => g.set('Y', !!g.get(g.get('S') ? 'B' : 'A')))
