import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"

export const NORGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 Q16 24 0 48 L20 48 Q40 48 42 24 Q40 0 20 0 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={2} />
        <path d="M42 24 L48 24" stroke="#999" strokeWidth={2} />
    </GateView>
}

export class NORGate extends Gate {
    static View = NORGateView
    constructor() {
        super([2, 2], {
            'Y': { 'type': 'out', 'coord': [2, 1], 'invert': true },
            'A': { 'type': 'in', 'coord': [0, 0] },
            'B': { 'type': 'in', 'coord': [0, 2] }
        })
    }

    update() { return this.set('Y', !(this.get('A') || this.get('B'))) }
}
