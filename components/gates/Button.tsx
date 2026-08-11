import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"
import { coord } from "../../lib/coord"

export const ButtonView = (props: GateViewProps) => {
    const { gate } = props
    return <GateView {...props}>
        <rect width={gate.size.x} height={gate.size.y} fill={gate.get('Y') ? "#7f7" : props.hover ? "#555" : '#000'} stroke="#9ca3af" rx={0.15} strokeWidth={0.08} />
    </GateView>
}

export const Button = makeGate("Button", [2, 2], ButtonView, { 'Y': { 'type': 'out', 'coord': coord([2, 1]) } }, () => false, (g) => g.set('Y', !g.get('Y')))
