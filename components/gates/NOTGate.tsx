import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"

export const NOTGateView = (props: GateViewProps) => {
    const { width, gate } = props
    const s = width / gate.size.x
    return <GateView {...props}>
        <path d={`M0 0 L${s * 1.75} ${s} L0 ${s * 2} Z`} fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={s * 0.08} />
        <path d={`M${s * 1.75} ${s} L${s * 2} ${s}`} stroke="#999" strokeWidth={s * 0.08} />
    </GateView>
}

export class NOTGate extends Gate {
    static View = NOTGateView
    constructor(name?: string) {
        super(name, [2, 2], {
            'Y': { 'type': 'out', 'coord': [2, 1], 'invert': true },
            'A': { 'type': 'in', 'coord': [0, 1] }
        })
    }

    update() { return this.set('Y', !this.get('A')) }
}
