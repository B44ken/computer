import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

const MUXGateView = (props: GateViewProps) => <GateView {...props}>
    <path d="M0 0L2 .5V1.5L0 2ZM1 1.75V3" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={.08}/>
    <text x={.45} y={1.25} fontSize={.65} fill="#ddd">m</text>
</GateView>
export const MUXGate = makeGate("MUX", [2, 3], MUXGateView, {
    A: {type:'in', coord:[0,0]}, B: {type:'in', coord:[0,2]},
    S: {type:'in', coord:[1,3]}, Y: {type:'out', coord:[2,1]}
}, g => g.set('Y', !!g.get(g.get('S') ? 'B' : 'A')))
