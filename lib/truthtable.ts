import { Lightbulb } from "../components/gates"
import { Gate } from "../components/gates"
import { Circuit } from "./circuit"
import { serializeCircuit, deserializeCircuit } from "./serialization"

const cartesianProd = (N: number): boolean[][] =>
    Array.from({ length: 2 ** N }, (_, i) => Array.from({ length: N }, (_, j) => Boolean(i & (1 << j))))

const pokeCircuit = (circuit: Circuit, inputParts: Gate[], inputs: boolean[]): void => {
    inputParts.forEach((btn, idx) => btn.set('Y', inputs[idx]))
    circuit.update()
}

export const truthTable = (circuit: Circuit, ins: Gate[], outs: Gate[]): { input: boolean[], output: boolean[] }[] => {
    // Evaluating a truth table must not drive the live editor's input buttons.
    const copy = deserializeCircuit(serializeCircuit(circuit))
    const corresponding = (g: Gate) => copy.gates[circuit.gates.findIndex(p => p.item === g)].item
    const inputs = ins.map(corresponding), outputs = outs.map(corresponding)
    return cartesianProd(ins.length).map(input => {
        pokeCircuit(copy, inputs, input)
        const output = outputs.map(g => (g instanceof Lightbulb ? g.pins.A : Object.values(g.pins).find(p => p.type == 'out'))?.voltage || false)
        return { input, output }
    })
}
