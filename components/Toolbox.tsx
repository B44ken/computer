import { Dispatch, SetStateAction, useEffect } from "react"
import { Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate, MUXGate, DFFGate, Cross, Memory } from "./gates"

const tools = [Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate, MUXGate, DFFGate, Cross, Memory, "Inspect", "Interact", "Erase", "Wire"]
export type Tool = typeof tools[number]
export const Toolbox = ({ tool, setTool, allowed, hotkeys = true }: { tool: Tool, setTool: Dispatch<SetStateAction<Tool>>, allowed?: string[], hotkeys?: boolean }) => {
    useEffect(() => {
        if (!hotkeys) return
        const keydown = ({ key, target }: KeyboardEvent) => {
            if (['INPUT','TEXTAREA','SELECT'].includes((target as HTMLElement)?.tagName)) return
            const binds = { "Escape": "Interact", "Backspace": "Erase", "Enter": "Wire" }
            if (key in binds) setTool(() => binds[key])
            if (/^[1-9]$/.test(key)) setTool(() => tools[Number(key) - 1])
        }
        addEventListener("keydown", keydown)
        return () => removeEventListener("keydown", keydown)
    }, [setTool, hotkeys])
    return <div className="flex justify-center flex-wrap select-none" data-testid="toolbox">
        {tools.filter(t => !allowed || typeof t === 'string' || allowed.includes(t.type)).map((t, i) => <button key={i} className={`mx-1 w-[72px] border-b-2 ${t == tool ? "font-bold" : ""}`} aria-pressed={t==tool} onClick={() => setTool(() => t)}>
            {typeof t == 'string' ? t : (t as any).type}
        </button>)}
    </div>
}
