import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"

export const ANDGateView = (props: GateViewProps) => {
    const { width, gate } = props
    const s = width / gate.size.x
    return <GateView {...props}>
        <path d={`M0 0 L${s} 0 A${s} ${s} 0 0 1 ${s} ${s * 2} L0 ${s * 2} Z`} fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={s * 0.08} />
    </GateView>
}

export class ANDGate extends Gate {
    static View = ANDGateView
    constructor(name?: string) {
        super(name, [2, 2], {
            'Y': { 'type': 'out', 'coord': [2, 1] },
            'A': { 'type': 'in', 'coord': [0, 0] },
            'B': { 'type': 'in', 'coord': [0, 2] }
        })
    }

    update() { return this.set('Y', this.get('A') && this.get('B')) }
}
