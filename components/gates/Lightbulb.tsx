import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const LightbulbView = (props: GateViewProps) => {
    const { gate } = props
    return <GateView {...props}>
        <rect width={gate.size.x} height={gate.size.y} fill={gate.get('A') ? "#7f7" : '#000'} stroke="#9ca3af" rx={0.15} strokeWidth={0.08} />
    </GateView>
}

export const Lightbulb = makeGate([2, 2], LightbulbView, { 'A': { 'type': 'in', 'coord': [0, 1] } }, (g) => g.set('A', g.get('A')))
