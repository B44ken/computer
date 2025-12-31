import { Circuit } from "../../lib/circuit"
import { CircuitBoard } from "../../components/CircuitBoard"
import { Button, Lightbulb, NANDGate, NOTGate, Wire } from "../../components/gates"
import { useState } from "react"
import { Tool, Toolbox } from "../../components/Toolbox"
import { useCircuit } from "../../hooks/useCircuit"

export default () => {
    const [tool, setTool] = useState<Tool>("Interact")
    const uc = useCircuit(new Circuit()
        .add(new Button(), [1, 6])
        .add(new Wire([[3, 7], [7, 7]]), [0, 0])
        .add(new NOTGate(), [7, 6])
        .add(new Wire([[9, 7], [10, 7]]), [0, 0])

        .add(new Button(), [4, 8])
        .add(new Wire([[6, 9], [10, 9]]), [0, 0])

        .add(new NANDGate(), [10, 7])
        .add(new Lightbulb(), [13, 7])
        .add(new Wire([[12, 8], [13, 8]]), [0, 0]))

    return <div className="m-2 h-full select-none">
        <Toolbox tool={tool} setTool={setTool} />
        <CircuitBoard tool={tool} {...uc} />
    </div>
}