import { Gate, GateView } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const DFFGateView = (props: GateViewProps) => <GateView {...props}>
    <rect width={2} height={2} fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={0.08} />
    <path d="M0 1.6 L.4 1.8 L0 2" stroke="#999" strokeWidth={0.08} fill="none" />
    <text x={0.7} y={1.15} fontSize={0.5} fill="#aaa">d</text>
</GateView>

export class DFFGate extends Gate {
    static type = "DFF"
    sequential = true
    private clock = false
    private pending: boolean | undefined
    constructor(name?: string) {
        super(name, [2, 2], {
            D: { type: 'in', coord: [0, 0] },
            CLK: { type: 'in', coord: [0, 2] },
            Q: { type: 'out', coord: [2, 1] }
        }, DFFGateView)
        this.powerOn()
    }
    powerOn(value = false) { this.set('Q', value); this.clock = false; this.pending = undefined }
    sample() {
        const clock = !!this.get('CLK')
        this.pending = clock && !this.clock ? !!this.get('D') : undefined
        this.clock = clock
    }
    commit() { return this.pending === undefined ? false : this.set('Q', this.pending) }
}
