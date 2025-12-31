import { Dispatch, SetStateAction, useEffect } from "react"
import { Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate } from "./gates"

const tools = [Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate, "Interact", "Erase", "Wire"]
export type Tool = typeof tools[number]
export const Toolbox = ({ tool, setTool }: { tool: Tool, setTool: Dispatch<SetStateAction<Tool>> }) => {
    useEffect(() => {
        addEventListener("keydown", ({ key }) => {
            const binds = { "Escape": "Interact", "Backspace": "Erase", "Enter": "Wire" }
            if (key in binds) setTool(() => binds[key])
            if ("123456789".includes(key)) setTool(() => tools[Number(key) - 1])
        })
    }, [])

    return <div className="flex justify-center flex-wrap select-none">
        {tools.map((t, i) =>
            <button key={i} className={`mx-1 w-[72px] border-b-2 ${t == tool ? "font-bold" : ""}`} onClick={() => setTool(() => t)}>
                {typeof t == 'string' ? t : (t as any).type}
            </button>
        )}
    </div >
}