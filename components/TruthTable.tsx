import { Button, Gate } from "./gates"
import { Circuit } from "../lib/circuit"
import { truthTable } from "../lib/truthtable"
import { useEffect, useState } from "react"

export const TruthTable = ({ circuit, ins, outs }: { circuit: Circuit, ins: Button[], outs: Gate[] }) => {
    const [table, setTable] = useState<{ input: boolean[], output: boolean[] }[]>([])
    useEffect(() => setTable(truthTable(circuit, ins, outs)), [circuit, ins, outs])

    const gates = [...ins, ...outs], vals = table.map(r => [...r.input, ...r.output])

    return <div className="*:mx-1 *:w-9 *:inline-block">
        {gates.map((gate, i) => <p key={i} className="border-b-2"> {gate.name} </p>)} <br />
        {vals.map((row, i) => <div key={i}> {row.map((_, j) => <p key={j} className="border-r-2"> {vals[j][i] ? 1 : 0} </p>)} </div>)}
    </div>
}