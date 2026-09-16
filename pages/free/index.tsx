import { useState } from "react"
import { Circuit } from "../../lib/circuit"
import { CircuitBoard } from "../../components/CircuitBoard"
import { Tool, Toolbox } from "../../components/Toolbox"
import { useCircuit } from "../../hooks/useCircuit"
import Link from 'next/link'

export default () => {
    const [tool, setTool] = useState<Tool>("Interact")
    const [circuit] = useState(() => new Circuit())
    const uc = useCircuit(circuit)

    return (
        <div className="flex flex-col h-full m-2 select-none">
            <div className="flex justify-between items-center mb-2">
                <Link href="/" className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                    &larr; Back to Home
                </Link>
                <h1 className="text-xl font-bold">Free Build</h1>
                <div className="w-[100px]"></div> {/* spacer to balance back button */}
            </div>
            <Toolbox tool={tool} setTool={setTool} />
            <div className="flex-1 min-h-0 mt-2 relative">
                <CircuitBoard tool={tool} {...uc} />
            </div>
        </div>
    )
}
