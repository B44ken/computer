import { Gate, GateView } from "./core/Gate"
import { GateViewProps } from "./core/types"

const DFFView = (props: GateViewProps) => <GateView {...props}>
    <rect width={2} height={2} rx={.1} fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={.08}/>
    <path d="M.6 2L1 1.6L1.4 2M1 2V3" fill="none" stroke="#999" strokeWidth={.08}/>
    <text x={.45} y={1.25} fontSize={.65} fill="#ddd">d</text>
</GateView>
export class DFF extends Gate {
    static type = 'DFF'
    private clock = false
    private pending: boolean | undefined
    constructor(name?: string) {
        super(name, [2,3], {D:{type:'in',coord:[0,1]}, CLK:{type:'in',coord:[1,3]}, Q:{type:'out',coord:[2,1]}}, DFFView)
        this.set('Q', false)
    }
    powerOn() { this.clock=false;this.pending=undefined;this.set('Q',false) }
    sample() {
        const clock = !!this.get('CLK')
        this.pending = clock && !this.clock ? !!this.get('D') : undefined
        this.clock = clock
    }
    commit() {
        if (this.pending === undefined) return false
        const value = this.pending; this.pending = undefined
        return this.set('Q', value)
    }
}
