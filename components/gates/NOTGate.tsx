import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"

export const NOTGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 L42 24 L0 48 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={2} strokeLinejoin="round" />
        <path d="M42 24 L48 24" stroke="#999" strokeWidth={2} />
    </GateView>
}

export class NOTGate extends Gate {
    static View = NOTGateView
    constructor() {
        super([2, 2], {
            'Y': { 'type': 'out', 'coord': [2, 1], 'invert': true },
            'A': { 'type': 'in', 'coord': [0, 1] }
        })
    }

    update() { return this.set('Y', !this.get('A')) }
}
