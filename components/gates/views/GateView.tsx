import { GateViewProps, Pin } from "../core/types"

export const GateView = ({ gate, width, height, children }: GateViewProps & { children: React.ReactNode }) => {
    return <>
        <g> {children} </g>
        {Object.entries(gate.pins as Record<string, Pin>).map(([key, { coord, voltage, invert }]) =>
            <circle key={key} cx={coord.x * width / gate.size.x} cy={coord.y * height / gate.size.y}
                r={invert ? 6 : 4}
                fill={voltage ? "#7e7" : "#000"}
                stroke="#999"
                strokeWidth={1}
            />
        )}
    </>
}
