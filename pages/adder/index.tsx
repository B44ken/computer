import { useState } from "react"
import { Tool, Toolbox } from "../../components/Toolbox"
import { useCircuit } from "../../hooks/useCircuit"
import { Circuit } from "../../lib/circuit"
import { Button, Lightbulb, Wire, XORGate, ANDGate, ORGate } from "../../components/gates"
import { CircuitBoard } from "../../components/CircuitBoard"

const createAdderCircuit = () => {
    const c = new Circuit();

    // Inputs
    // A and B
    c.add(new Button(), [2, 2]); // A -> Out (4, 3)
    c.add(new Button(), [2, 4]); // B -> Out (4, 5)
    // Cin
    c.add(new Button(), [2, 8]); // Cin -> Out (4, 9)

    // STAGE 1: Half Adder (A, B)
    // XOR1 (A, B) -> Sum1
    // Inputs at (0,0) and (0,2). We want inputs at Y=3 and Y=5.
    // So XOR1 at [8, 3] -> Inputs at [8, 3] and [8, 5].
    c.add(new XORGate(), [8, 3]);

    // AND1 (A, B) -> Carry1
    // We want inputs at Y=3 and Y=5? Or branched?
    // Let's place AND1 lower. At [8, 7].
    // Inputs at [8, 7] and [8, 9].
    c.add(new ANDGate(), [8, 7]);

    // Wiring Stage 1
    // A (4,3) -> XOR1_inA (8,3) and AND1_inA (8,7)
    c.add(new Wire([[4, 3], [8, 3]])); // A -> XOR1
    c.add(new Wire([[5, 3], [5, 7], [8, 7]])); // A -> AND1 (branch from x=5)

    // B (4,5) -> XOR1_inB (8,5) and AND1_inB (8,9)
    c.add(new Wire([[4, 5], [8, 5]])); // B -> XOR1
    c.add(new Wire([[6, 5], [6, 9], [8, 9]])); // B -> AND1 (branch from x=6)


    // STAGE 2: Half Adder (Sum1, Cin)
    // XOR1 Out is at [8+2, 3+1] = [10, 4].
    // Cin Out is at [4, 9].

    // We need XOR2 inputs for Sum1 and Cin.
    // XOR2 at [16, 4]. Inputs at [16, 4] and [16, 6].
    c.add(new XORGate(), [16, 4]);

    // AND2 for Carry Logic 2
    // Inputs sum1 and Cin. 
    // AND2 at [16, 8]. Inputs at [16, 8] and [16, 10].
    c.add(new ANDGate(), [16, 8]);

    // Wiring Stage 2
    // Sum1 (10, 4) -> XOR2_inA (16, 4) and AND2_inA (16, 8)
    c.add(new Wire([[10, 4], [16, 4]])); // Sum1 -> XOR2
    c.add(new Wire([[12, 4], [12, 8], [16, 8]])); // Sum1 -> AND2

    // Cin (4, 9) -> XOR2_inB (16, 6) and AND2_inB (16, 10)
    // Cin is at (4,9).
    // Route to (16, 6): [4,9] -> [7,9] -> [7,6] -> [16,6].
    // Route to (16, 10): [4,9] -> [7,9] -> [7,10] -> [16,10].
    c.add(new Wire([[4, 9], [7, 9], [7, 6], [16, 6]])); // Cin -> XOR2
    c.add(new Wire([[7, 9], [7, 10], [16, 10]])); // Cin -> AND2


    // STAGE 3: Carry OR
    // Inputs: Carry1 (AND1_out) and Carry2 (AND2_out).
    // AND1_out: [8+2, 7+1] = [10, 8].
    // AND2_out: [16+2, 8+1] = [18, 9].

    // OR Gate at [22, 8]. Inputs [22, 8] and [22, 10].
    c.add(new ORGate(), [22, 8]);

    // Wiring Stage 3
    // Carry1 (10, 8) -> OR_inA (22, 8).
    c.add(new Wire([[10, 8], [22, 8]]));

    // Carry2 (18, 9) -> OR_inB (22, 10).
    c.add(new Wire([[18, 9], [19, 9], [19, 10], [22, 10]]));


    // OUTPUTS
    // Sum Out: XOR2_out -> Lightbulb
    // XOR2_out at [16+2, 4+1] = [18, 5].
    // Lightbulb at [26, 4]. Input [26, 5].
    c.add(new Lightbulb(), [26, 4]);
    c.add(new Wire([[18, 5], [26, 5]]));

    // Carry Out: OR_out -> Lightbulb
    // OR_out at [22+2, 8+1] = [24, 9].
    // Lightbulb at [26, 8]. Input [26, 9].
    c.add(new Lightbulb(), [26, 8]);
    c.add(new Wire([[24, 9], [26, 9]]));

    return c;
}

export default () => {
    const [circuit] = useState(() => createAdderCircuit());
    const uc = useCircuit(circuit)

    const [tool, setTool] = useState<Tool>("Interact")

    return <div className="m-2 h-full select-none">
        <Toolbox tool={tool} setTool={setTool} />
        <CircuitBoard tool={tool} {...uc} />
    </div>
}