import { useState } from "react"
import { Tool, Toolbox } from "../../components/Toolbox"
import { useCircuit } from "../../hooks/useCircuit"
import { Circuit } from "../../lib/circuit"
import { ANDGate, Button, Lightbulb, ORGate, Wire, XORGate } from "../../components/gates"
import { CircuitBoard } from "../../components/CircuitBoard"

type Pt = [number, number]

// one full adder: sum = a^b^cin, cout = ab + cin(a^b)
// returns the points where a, b and cin enter and where sum / cout leave
const fullAdder = (c: Circuit, [X, Y]: Pt) => {
    const at = (x: number, y: number): Pt => [X + x, Y + y]
    const wire = (...path: Pt[]) => c.add(new Wire(path.map(([x, y]) => at(x, y))))

    c.add(new XORGate(), at(0, 0))  // a ^ b
    c.add(new ANDGate(), at(0, 4))  // a & b
    c.add(new XORGate(), at(6, 1))  // sum
    c.add(new ANDGate(), at(6, 6))  // cin & (a ^ b)
    c.add(new ORGate(), at(12, 8))  // cout

    wire([-4, 0], [0, 0]), wire([-2, 0], [-2, 4], [0, 4])   // a
    wire([-3, 6], [-3, 2], [0, 2]), wire([-3, 6], [0, 6])   // b
    wire([-4, 9], [5, 9], [5, 3], [6, 3]), wire([5, 8], [6, 8])  // cin
    wire([2, 1], [6, 1]), wire([4, 1], [4, 6], [6, 6])      // a ^ b
    wire([2, 5], [3, 5], [3, 11], [11, 11], [11, 10], [12, 10])  // a & b
    wire([8, 7], [10, 7], [10, 8], [12, 8])                 // cin & (a ^ b)

    return { a: at(-4, 0), b: at(-3, 6), cin: at(-4, 9), sum: at(8, 2), cout: at(14, 9) }
}

export const build4BitAdder = () => {
    const c = new Circuit()
    const [X0, Y, dx] = [12, 12, 20]

    const cin = new Button("cin")
    c.add(cin, [X0 - 10, Y + 8])

    const a: InstanceType<typeof Button>[] = [], b: typeof a = [], s: InstanceType<typeof Lightbulb>[] = []
    let carry: Pt = [X0 - 8, Y + 9]

    for (let i = 0; i < 4; i++) {
        const X = X0 + i * dx
        const fa = fullAdder(c, [X, Y])
        c.add(new Wire([carry, fa.cin]))

        a.push(new Button(`a${i}`)), b.push(new Button(`b${i}`)), s.push(new Lightbulb(`s${i}`))
        c.add(a[i], [X - 6, Y - 10])
        c.add(b[i], [X - 5, Y + 12])
        c.add(s[i], [X + 9, Y - 6])
        c.add(new Wire([[X - 4, Y - 9], fa.a]))
        c.add(new Wire([[X - 3, Y + 13], fa.b]))
        c.add(new Wire([fa.sum, [X + 9, Y + 2], [X + 9, Y - 5]]))

        carry = fa.cout
    }

    const cout = new Lightbulb("cout")
    c.add(cout, [carry[0] + 2, Y + 8])
    c.add(new Wire([carry, [carry[0] + 2, Y + 9]]))

    return { circuit: c, a, b, cin, s, cout }
}

export default () => {
    const [{ circuit }] = useState(build4BitAdder)
    const uc = useCircuit(circuit)
    const [tool, setTool] = useState<Tool>("Interact")

    return <div className="m-2 h-full select-none">
        <Toolbox tool={tool} setTool={setTool} />
        <CircuitBoard tool={tool} scale={16} {...uc} />
    </div>
}
