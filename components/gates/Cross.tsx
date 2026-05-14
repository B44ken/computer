import { GateView, makeGate } from "./core/Gate"
import { GateViewProps } from "./core/types"

export const CrossView = (props: GateViewProps) => {

    return <GateView {...props}>
        <path d="M0 0 L1 1 M1 0 L0 1" stroke={props.hover ? "#9ca3af" : "#999"} strokeWidth={0.08} fill="none" />
    </GateView>
}

// A 1x1 crossover where TopLeft (0,0) -> BottomRight (1,1)
// and TopRight (1,0) -> BottomLeft (0,1)
export const Cross = makeGate("Cross", [1, 1], CrossView, {
    'TL': { 'type': 'in', 'coord': [0, 0] },
    'TR': { 'type': 'in', 'coord': [1, 0] },
    'BL': { 'type': 'out', 'coord': [0, 1] },
    'BR': { 'type': 'out', 'coord': [1, 1] }
}, (g) => {
    let changed = false
    if (g.set('BR', g.get('TL') || false)) changed = true
    if (g.set('BL', g.get('TR') || false)) changed = true
    return changed
})
