import { Gate } from "./core/Gate"
import { GateView } from "./views/GateView"
import { GateViewProps } from "./core/types"

export const LightbulbView = (props: GateViewProps) => {
    const { width, height, gate } = props
    const s = width / gate.size.x
    return <GateView {...props}>
        <rect width={width} height={height} fill={gate.get('A') ? "#7f7" : '#000'} stroke="#9ca3af" rx={s * 0.15} />
    </GateView>
}

export class Lightbulb extends Gate {
    static View = LightbulbView
    constructor(name: string) {
        super(name, [2, 2], { 'A': { 'type': 'in', 'coord': [0, 1] } })
    }
}
