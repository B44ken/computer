import { Gate, GateView } from './core/Gate'
import { GateViewProps } from './core/types'
export const DFFGateView = (props: GateViewProps) => <GateView {...props}>
    <rect width={2} height={2} fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08}/>
    <path d="M0.7 2 L1 1.6 L1.3 2" fill="none" stroke="#999" strokeWidth={0.08}/>
    <text x={0.2} y={1.2} fill="#999" fontSize={0.55}>d</text>
    <text x={1.35} y={1.2} fill="#999" fontSize={0.55}>q</text>
</GateView>
export class DFFGate extends Gate {
    static type = 'DFF'
    next = false
    constructor(name?: string, public initial = false) {
        super(name, [2, 2], {
            D: { type: 'in', coord: [0, 1] }, Q: { type: 'out', coord: [2, 1] }
        }, DFFGateView)
        this.set('Q', initial)
    }
    // The circuit's shared clock is a two-phase global tick. Settling gates
    // must never advance a flip-flop or expose a partially updated register.
    sample() { this.next = Boolean(this.get('D')) }
    commit() { return this.set('Q', this.next) }
    reset() { this.next = this.initial; this.set('Q', this.initial) }
}
