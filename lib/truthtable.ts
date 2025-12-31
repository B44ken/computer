import { Button, Lightbulb } from "../components/gates"
import { Gate } from "../components/gates"
import { Circuit } from "./circuit"

const cartesianProd = (N: number): boolean[][] =>
    Array.from({ length: 2 ** N }, (_, i) => Array.from({ length: N }, (_, j) => Boolean(i & (1 << j))))

const pokeCircuit = (circuit: Circuit, inputParts: Button[], inputs: boolean[]): void => {
    inputParts.forEach((btn, idx) => btn.set('Y', inputs[idx]))
    circuit.update()
}

export const truthTable = (circuit: Circuit, ins: Gate[], outs: Gate[]): { input: boolean[], output: boolean[] }[] =>
    cartesianProd(ins.length).map(input => {
        pokeCircuit(circuit, ins, input)
        const output = outs.map(g => (g instanceof Lightbulb ? g.pins.A : Object.values(g.pins).find(p => p.type == 'out'))?.voltage || false)
        return { input, output }
    })