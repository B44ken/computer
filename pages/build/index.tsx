import { useState } from "react"
import Link from 'next/link'
import { Circuit } from "../../lib/circuit"
import { CircuitBoard } from "../../components/CircuitBoard"
import { Tool, Toolbox } from "../../components/Toolbox"
import { useCircuit } from "../../hooks/useCircuit"
import { Button, Lightbulb, Gate } from "../../components/gates"




export default () => {
    const [step, setStep] = useState(0);

    const steps = [
        <Step0 onComplete={() => setStep(1)} />,
        <Step1 onComplete={() => setStep(2)} />,
        <Step2 onComplete={() => setStep(3)} />,
        <Step3 onComplete={() => setStep(4)} />,
        <Step4 />
    ]

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 p-8 select-none overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                    <Link href="/" className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                        &larr; Back to Home
                    </Link>
                    <h1 className="text-3xl font-bold">Tutorial: Building a Computer</h1>
                    <div className="w-[100px]"></div>
                </div>

                {steps.slice(0, step + 1).map((StepComponent, idx) => (
                    <div key={idx} className={`mb-12 p-6 bg-white rounded-xl shadow-sm border border-gray-200 transition-opacity duration-500 ${idx < step ? 'opacity-50 hover:opacity-100' : 'opacity-100'}`}>
                        {StepComponent}
                    </div>
                ))}
            </div>
        </div>
    )
}

// Helper to check if a circuit meets a truth table requirement
const checkTruthTable = (circuit: Circuit, ins: Gate[], outs: Gate[], expected: boolean[][]) => {
    const N = ins.length;
    let success = true;
    for (let i = 0; i < (1 << N); i++) {
        // Set inputs
        for (let j = 0; j < N; j++) {
            ins[j].set('Y', Boolean(i & (1 << j)));
        }

        circuit.update();
        circuit.update(); // propagate multiple stages if needed
        circuit.update();
        circuit.update();

        // Check outputs
        for (let j = 0; j < outs.length; j++) {
            const outVal = (outs[j] instanceof Lightbulb ? (outs[j] as any).pins.A : Object.values(outs[j].pins).find(p => p.type == 'out'))?.voltage || false;
            if (outVal !== expected[i][j]) {
                success = false;
                break;
            }
        }
        if (!success) break;
    }
    // reset inputs to false
    ins.forEach(g => g.set('Y', false));
    circuit.update();
    return success;
}

const Step0 = ({ onComplete }: { onComplete: () => void }) => {
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Chapter 1: The Basics - 1s and 0s</h2>
            <p className="mb-4 text-lg">
                At the lowest level, computers operate on binary values: <strong>1s and 0s</strong>.
                In the real world, this isn't magic. It's usually represented by electricity: high voltage (1) or low voltage (0).
                Historically, this was done using mechanical relays or vacuum tubes, but today we use <strong>transistors</strong>.
            </p>
            <p className="mb-4 text-lg">
                Think of a transistor as a tiny, electrically-controlled switch. When you apply a voltage to one part of it, it lets electricity flow through another part. By combining these tiny switches, we can build logic gates!
            </p>
            <button onClick={onComplete} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                I understand, let's build!
            </button>
        </div>
    )
}

const Step1 = ({ onComplete }: { onComplete: () => void }) => {
    const [tool, setTool] = useState<Tool>("Interact")
    const [circuitData] = useState(() => {
        const c = new Circuit();
        const a = new Button("a");
        const b = new Button("b");
        const l = new Lightbulb("out");

        c.add(a, [2, 2]);
        c.add(b, [2, 6]);
        c.add(l, [12, 4]);

        return { circuit: c, ins: [a, b], outs: [l] };
    });
    const uc = useCircuit(circuitData.circuit);


    const verify = () => {
        const expected = [[false], [false], [false], [true]];
        if (checkTruthTable(uc.circuit, circuitData.ins, circuitData.outs, expected)) {
            onComplete();
        } else {
            alert("Not quite right. An AND gate should only output 1 when BOTH inputs are 1. Try placing an AND gate and connecting the inputs and outputs.");
        }
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Chapter 2: Logic Gates - The AND Gate</h2>
            <p className="mb-4 text-lg">
                Let's abstract those transistors into <strong>Logic Gates</strong>. An <strong>AND</strong> gate takes two inputs and outputs a 1 <em>only if both inputs are 1</em>.
            </p>
            <p className="mb-4 text-lg font-semibold text-blue-700">
                Task: Place an AND gate from the toolbox, wire the two buttons to its inputs, and wire its output to the lightbulb. Then press verify.
            </p>

            <div className="h-64 border rounded mb-4">
                <Toolbox tool={tool} setTool={setTool} />
                <CircuitBoard tool={tool} {...uc} />
            </div>

            <button onClick={verify} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                Verify AND Gate
            </button>
        </div>
    )
}

const Step2 = ({ onComplete }: { onComplete: () => void }) => {
    const [tool, setTool] = useState<Tool>("Interact")
    const [circuitData] = useState(() => {
        const c = new Circuit();
        const a = new Button("a");
        const b = new Button("b");
        const l = new Lightbulb("out");

        c.add(a, [2, 2]);
        c.add(b, [2, 6]);
        c.add(l, [12, 4]);

        return { circuit: c, ins: [a, b], outs: [l] };
    });
    const uc = useCircuit(circuitData.circuit);


    const verify = () => {
        const expected = [[false], [true], [true], [false]];
        if (checkTruthTable(uc.circuit, circuitData.ins, circuitData.outs, expected)) {
            onComplete();
        } else {
            alert("Not quite right. Remember, XOR outputs 1 when the inputs are DIFFERENT.");
        }
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Chapter 3: The XOR Gate</h2>
            <p className="mb-4 text-lg">
                There are other gates too! <strong>OR</strong> outputs 1 if at least one input is 1. <strong>NOT</strong> flips the input.
                A very important gate for math is the <strong>XOR</strong> (Exclusive OR) gate. It outputs 1 if the inputs are <em>different</em> (one is 1, the other is 0).
            </p>
            <p className="mb-4 text-lg font-semibold text-blue-700">
                Task: Build an XOR circuit. You can just use the XOR gate directly from the toolbox for now, or build it yourself using AND, OR, and NOT gates! Wire the buttons to it, and its output to the lightbulb.
            </p>

            <div className="h-64 border rounded mb-4">
                <Toolbox tool={tool} setTool={setTool} />
                <CircuitBoard tool={tool} {...uc} />
            </div>

            <button onClick={verify} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                Verify XOR Gate
            </button>
        </div>
    )
}

const Step3 = ({ onComplete }: { onComplete: () => void }) => {
    const [tool, setTool] = useState<Tool>("Interact")
    const [circuitData] = useState(() => {
        const c = new Circuit();
        const a = new Button("a");
        const b = new Button("b");
        const sum = new Lightbulb("sum");
        const carry = new Lightbulb("carry");

        c.add(a, [2, 2]);
        c.add(b, [2, 6]);

        c.add(sum, [14, 2]);
        c.add(carry, [14, 6]);

        return { circuit: c, ins: [a, b], outs: [sum, carry] };
    });
    const uc = useCircuit(circuitData.circuit);


    const verify = () => {
        const expected = [
            [false, false],
            [true, false],
            [true, false],
            [false, true]
        ];
        if (checkTruthTable(uc.circuit, circuitData.ins, circuitData.outs, expected)) {
            onComplete();
        } else {
            alert("Not quite. Sum uses an XOR gate, Carry uses an AND gate. Both gates should connect to both inputs.");
        }
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Chapter 4: The Half Adder</h2>
            <p className="mb-4 text-lg">
                Now let's do some math! When you add two binary numbers (A and B), there are two outputs: the <strong>Sum</strong> and the <strong>Carry</strong>.
                <br/>0 + 0 = 0 (Sum 0, Carry 0)
                <br/>1 + 0 = 1 (Sum 1, Carry 0)
                <br/>0 + 1 = 1 (Sum 1, Carry 0)
                <br/>1 + 1 = 2... which in binary is 10! (Sum 0, Carry 1)
            </p>
            <p className="mb-4 text-lg">
                Look closely at the rules: The <em>Sum</em> acts exactly like an <strong>XOR</strong> gate. The <em>Carry</em> acts exactly like an <strong>AND</strong> gate!
            </p>
            <p className="mb-4 text-lg font-semibold text-blue-700">
                Task: Build a Half Adder. Wire the two buttons (A and B) into both an XOR gate (for Sum) and an AND gate (for Carry). Connect the outputs to the respective lightbulbs (Top lightbulb is Sum, bottom is Carry).
            </p>

            <div className="h-[400px] border rounded mb-4">
                <Toolbox tool={tool} setTool={setTool} />
                <CircuitBoard tool={tool} {...uc} />
            </div>

            <button onClick={verify} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                Verify Half Adder
            </button>
        </div>
    )
}

const Step4 = () => {
    return (
        <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-green-600">Congratulations! 🎉</h2>
            <p className="text-xl mb-4">
                You've successfully built a Half Adder! This is the fundamental building block of a computer's Arithmetic Logic Unit (ALU).
            </p>
            <p className="text-lg mb-8">
                By chaining two half adders and an OR gate together, you can create a <strong>Full Adder</strong>, which can add numbers with a carry-in from a previous operation. String 8 full adders together, and you have an 8-bit calculator!
            </p>
            <Link href="/free" className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-lg font-semibold">
                Go to Free Build
            </Link>
        </div>
    )
}
