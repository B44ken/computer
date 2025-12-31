import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"
import { coord } from "../../lib/coord"

export const ButtonView = (props: GateViewProps) => {
    return <GateView {...props}>
        <rect width={props.gate.size.x} height={props.gate.size.y} fill={props.hover ? "#555" : '#000'} stroke="#9ca3af" rx={0.15} strokeWidth={0.08} />
    </GateView>
}

export const Button = makeGate("Button", [2, 2], ButtonView, { 'Y': { 'type': 'out', 'coord': coord([2, 1]) } }, (g) => g.set('Y', !g.get('Y')))
