import { GateViewProps, Pin } from "../core/types"

export const GateView = ({ gate, width, children }: GateViewProps & { children: React.ReactNode }) => {
    const scale = width / gate.size.x
    return <>
        <g> {children} </g>
        {Object.entries(gate.pins as Record<string, Pin>).map(([key, { coord, voltage, invert }]) =>
            <circle key={key} cx={coord.x * scale} cy={coord.y * scale}
                r={invert ? scale * 0.25 : scale * 0.16}
                fill={voltage ? "#7e7" : "#000"}
                stroke="#999"
                strokeWidth={scale * 0.05}
            />
        )}
    </>
}
