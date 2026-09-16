import { Circuit } from '../circuit'
import { Wire } from '../../components/gates/core/Wire'
import { MemoryGate } from '../../components/gates/MemoryGate'
import { part, crossPart, crossRotation } from './parts'
import { Layout } from './model'

// Export the layout into the same objects used by /free and the adder pages.
// No net-ID connections, alternate evaluator, or replacement renderer.
export function loadComputer(layout: Layout) {
    const circuit = new Circuit()
    const add = (gate: ReturnType<typeof part>, x: number, y: number, rotation = 0) => {
        const count = circuit.gates.length
        circuit.add(gate, [x, y], rotation)
        if (circuit.gates.length !== count + 1) throw Error(`invalid gate placement: ${gate.name} at ${x},${y}`)
    }
    for (const c of layout.cells) add(part(c), c.x, c.y)
    for (const b of layout.bridges) add(crossPart(b), b.center[0] - 0.5, b.center[1] - 0.5, crossRotation(b))
    const memory = new MemoryGate(layout.terminals.filter(t => t.id === '0' || t.id === '1').map(t => t.id))
    add(memory, layout.memory.x, layout.memory.y)
    for (const trace of layout.traces) {
        const count = circuit.wires.length
        circuit.add(new Wire(trace.points))
        if (circuit.wires.length !== count + 1) throw Error(`invalid wire placement: ${trace.net} ${JSON.stringify(trace.points)}`)
    }
    circuit.buildConnections()
    if (circuit.errors.length) throw Error(circuit.errors.join('; '))
    if (circuit.unconnected!.length) throw Error(`unconnected: ${circuit.unconnected!.map(p => `${p.item.name}.${p.pin}`).join(', ')}`)
    if (circuit.wireDrivers.size !== circuit.wires.length) throw Error('undriven wire')
    circuit.reset()
    return { circuit, memory }
}

// Instrumentation only: these values are read from the real memory pins.
export function snapshot(memory: MemoryGate) {
    return { pc: memory.readBus('out_pc', 6), a: memory.readBus('out_mem', 8), inst: memory.readBus('inst', 8),
        operand: memory.readBus('in_mem', 8), address: memory.readBus('out_adr', 6), we: Boolean(memory.get('we[0]')) }
}
export type Snapshot = ReturnType<typeof snapshot>
