import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"

export const XORGateView = (props: GateViewProps) => {
    const { width, gate } = props
    const s = width / gate.size.x
    return <GateView {...props}>
        <path d={`M0 0 Q${s * 0.66} ${s} 0 ${s * 2}`} fill="none" stroke="#999" strokeWidth={s * 0.08} />
        <path d={`M${s * 0.16} 0 Q${s * 0.83} ${s} ${s * 0.16} ${s * 2} L${s} ${s * 2} Q${s * 1.91} ${s * 2} ${s * 2} ${s} Q${s * 1.91} 0 ${s} 0 Z`} fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={s * 0.08} />
    </GateView>
}

export class XORGate extends Gate {
    static View = XORGateView
    constructor(name?: string) {
        super(name, [2, 2], {
            'Y': { 'type': 'out', 'coord': [2, 1] },
            'A': { 'type': 'in', 'coord': [0, 0] },
            'B': { 'type': 'in', 'coord': [0, 2] }
        })
    }

    update() { return this.set('Y', this.get('A') != this.get('B')) }
}
