import { ANDGate, Button, Lightbulb, Wire, XORGate } from "../../components/gates"
import { Circuit } from "../../lib/circuit"
import { useCircuit } from "../../hooks/useCircuit"
import { CircuitBoard } from "../../components/CircuitBoard"
import { TruthTable } from "../../components/TruthTable"
import { useState } from "react"
import { Tool, Toolbox } from "../../components/Toolbox"

export default () => {
    const [selected, setSelected] = useState<Tool>("Interact")
    const [circuitData] = useState(() => {
        const c = new Circuit()
        const a = new Button("a")
        const b = new Button("b")
        const xor = new XORGate()
        const and = new ANDGate()
        const sum = new Lightbulb("sum")
        const carry = new Lightbulb("car")

        c.add(a, [1, 1])
        c.add(b, [1, 4])
        c.add(xor, [7, 2])
        c.add(and, [7, 5])
        c.add(sum, [10, 2])
        c.add(carry, [10, 5])

        c.add(new Wire([[3, 2], [7, 2]]))
        c.add(new Wire([[3, 5], [7, 5]]))
        c.add(new Wire([[5, 2], [5, 7], [7, 7]]))
        c.add(new Wire([[6, 5], [6, 4], [7, 4]]))
        c.add(new Wire([[9, 3], [10, 3]]))
        c.add(new Wire([[9, 6], [10, 6]]))

        return { circuit: c, ins: [a, b], outs: [sum, carry] }
    })

    const uc = useCircuit(circuitData.circuit)

    return <div className="m-2 h-full relative flex flex-row justify-evenly">
        <CircuitBoard tool={selected} circuit={uc.circuit} onGateMove={uc.updateGate} />
        <div className="w-[30%] flex flex-col items-center gap-2">
            <Toolbox selected={selected} setSelected={setSelected} />
            <TruthTable circuit={uc.circuit} ins={circuitData.ins} outs={circuitData.outs} />
        </div>
    </div>
}