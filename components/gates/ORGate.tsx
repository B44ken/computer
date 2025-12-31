import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"

export const ORGateView = (props: GateViewProps) => {
    return <GateView {...props}>
        <path d="M0 0 Q16 24 0 48 L20 48 Q42 48 48 24 Q42 0 20 0 Z" fill={props.hover ? '#555' : '#000'} stroke="#999" strokeWidth={2} />
    </GateView>
}

export class ORGate extends Gate {
    static View = ORGateView
    constructor() {
        super([2, 2], {
            'Y': { 'type': 'out', 'coord': [2, 1] },
            'A': { 'type': 'in', 'coord': [0, 0] },
            'B': { 'type': 'in', 'coord': [0, 2] }
        })
    }

    update() { return this.set('Y', this.get('A') || this.get('B')) }
}
