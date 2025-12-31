import { Dispatch, SetStateAction } from "react"
import { Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate } from "./gates"

const tools = ["Interact", "Erase", "Wire", Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate]
export type Tool = typeof tools[number]
export const Toolbox = ({ selected, setSelected }: { selected: Tool, setSelected: Dispatch<SetStateAction<Tool>> }) => {
    return <div>
        {tools.map((t, i) => {
            const name = typeof t == 'string' ? t : t.name
            return <button key={i} className={'px-1'} onClick={() => setSelected(() => t)}>
                {t == selected ? <b>{name}</b> : name}
            </button>
        })}
    </div>
}