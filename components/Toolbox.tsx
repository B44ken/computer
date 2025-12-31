import { Dispatch, SetStateAction, useEffect } from "react"
import { Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate } from "./gates"

const tools = [Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate, "Interact", "Erase", "Wire"]
export type Tool = typeof tools[number]
export const Toolbox = ({ selected, setSelected }: { selected: Tool, setSelected: Dispatch<SetStateAction<Tool>> }) => {
    useEffect(() => {
        addEventListener("keydown", (e) => {
            if (e.key == "Escape") setSelected(() => "Interact")
            if (e.key == "Backspace") setSelected(() => "Erase")
            if (e.key == "Enter") setSelected(() => "Wire")
            if ("123456789".includes(e.key)) setSelected(() => tools[Number(e.key) - 1])
        })
    }, [])

    return <div className="flex justify-center flex-wrap select-none">
        {tools.map((t, i) => {
            const name = typeof t == 'string' ? t : t.name.replace("Gate", "")
            return <button key={i} className={'mx-1 w-[72px] border-b-2'} onClick={() => setSelected(() => t)}>
                {t == selected ? <b>{name}</b> : name}
            </button>
        })}
    </div >
}