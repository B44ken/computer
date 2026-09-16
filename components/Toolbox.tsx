import { Dispatch, SetStateAction, useEffect } from "react"
import { Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate, Cross, MUXGate, DFFGate, MemoryGate } from "./gates"

const tools = [Button, Lightbulb, NANDGate, NOTGate, ORGate, ANDGate, NORGate, XORGate, XNORGate, Cross, MUXGate, DFFGate, MemoryGate, "Interact", "Erase", "Wire"]
export type Tool = typeof tools[number]
export const Toolbox = ({ tool, setTool }: { tool: Tool, setTool: Dispatch<SetStateAction<Tool>> }) => {
    useEffect(() => {
        const keydown = ({ key, target }: KeyboardEvent) => {
            if (/INPUT|TEXTAREA|SELECT/.test((target as HTMLElement).tagName)) return
            const binds = { Escape: 'Interact', Backspace: 'Erase', Enter: 'Wire' }
            if (key in binds) setTool(() => binds[key])
            if (/^[1-9]$/.test(key)) setTool(() => tools[Number(key) - 1])
        }
        addEventListener('keydown', keydown)
        return () => removeEventListener('keydown', keydown)
    }, [setTool])

    return <div className="flex justify-center flex-wrap select-none">
        {tools.map((t, i) =>
            <button key={i} className={`mx-1 w-[72px] border-b-2 ${t == tool ? "font-bold" : ""}`} onClick={() => setTool(() => t)}>
                {typeof t == 'string' ? t : (t as any).type}
            </button>
        )}
    </div >
}