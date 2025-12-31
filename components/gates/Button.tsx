import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"
import { coord } from "../../lib/coord"

export const ButtonView = (props: GateViewProps) => {
    const { width, height, hover } = props
    return <GateView {...props}>
        <rect width={width} height={height} fill={hover ? "#555" : '#000'} stroke="#9ca3af" rx="4" />
    </GateView>
}

export class Button extends Gate {
    static View = ButtonView
    constructor() {
        super([2, 2], { 'Y': { 'type': 'out', 'coord': coord([2, 1]) } })
    }

    click() { this.set('Y', !this.get('Y')) }
}
