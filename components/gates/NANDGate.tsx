import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"

export const NANDGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 L18 0 A24 24 0 0 1 18 48 L0 48 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={2} />
        <path d="M42 24 L48 24" stroke="#999" strokeWidth={2} />
    </GateView>
}

export class NANDGate extends Gate {
    static View = NANDGateView
    constructor() {
        super([2, 2], {
            'Y': { 'type': 'out', 'coord': [2, 1], 'invert': true },
            'A': { 'type': 'in', 'coord': [0, 0] },
            'B': { 'type': 'in', 'coord': [0, 2] }
        })
    }

    update() { return this.set('Y', !(this.get('A') && this.get('B'))) }
}
