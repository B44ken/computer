import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Circuit } from '../lib/circuit'
import { coord } from '../lib/coord'
import { Wire, Cross, DFFGate, Button, Lightbulb, MemoryGate } from '../components/gates'
import { Spec, Layout } from '../lib/computer/model'
import { fromYosys } from '../lib/computer/yosys'
import { manualComputer } from '../lib/computer/manual'
import { loadComputer, snapshot } from '../lib/computer/load'
import { audit } from '../lib/computer/audit'
import { assemble, programs } from '../lib/computer/programs'
import { factories, crossPart } from '../lib/computer/parts'

const auto = fromYosys(JSON.parse(fs.readFileSync('hardware/stupid/gates.json', 'utf8')))
const specs = [auto, manualComputer().spec]
const layouts = ['manual', 'auto'].map(mode => JSON.parse(fs.readFileSync(`public/computer/${mode}.json`, 'utf8')) as Layout)

// Generate a fast Boolean-only test evaluator. This is not the application's
// simulator: exhaustive tests use it in addition to routed-geometry execution.
function logic(spec: Spec): (a: number, pc: number, inst: number, m: number) => { a: number, pc: number, we: boolean, address: number } {
    const names = new Map<string, string>(), code: string[] = [], done = new Set<string>()
    const name = (s: string) => { if (!names.has(s)) names.set(s, `v${names.size}`); return names.get(s)! }
    const put = (s: string, expr: string) => { code.push(`const ${name(s)}=${expr};`); done.add(s) }
    const port = (p: string) => spec.ports.find(v => v.name === p)!.bits
    put('0', 'false'); put('1', 'true')
    for (const [p, param] of [['inst', 'inst'], ['in_mem', 'm']] as const) port(p).forEach((s, i) => put(s, `Boolean(${param}&${1 << i})`))
    for (const [p, param] of [['out_mem', 'a'], ['out_pc', 'pc']] as const) port(p).forEach((s, i) => put(s, `Boolean(${param}&${1 << i})`))
    const pending = spec.cells.filter(c => c.kind !== 'DFF')
    while (pending.length) {
        const i = pending.findIndex(c => Object.entries(c.pins).filter(([p]) => p !== 'Y').every(([, s]) => done.has(s)))
        assert(i >= 0, 'acyclic combinational logic')
        const c = pending.splice(i, 1)[0], p = Object.fromEntries(Object.entries(c.pins).map(([p, s]) => [p, name(s)]))
        const expr = { AND: `${p.A}&&${p.B}`, NAND: `!(${p.A}&&${p.B})`, OR: `${p.A}||${p.B}`, NOR: `!(${p.A}||${p.B})`,
            XOR: `${p.A}!==${p.B}`, XNOR: `${p.A}===${p.B}`, NOT: `!${p.A}`, MUX: `${p.S}?${p.B}:${p.A}` }[c.kind]
        put(c.pins.Y, `(${expr})`)
    }
    const word = (bits: string[]) => bits.map((s, i) => `(${name(s)}?${1 << i}:0)`).join('|')
    const d = (s: string) => spec.cells.find(c => c.kind === 'DFF' && c.pins.Q === s)!.pins.D
    code.push(`return {a:${word(port('out_mem').map(d))},pc:${word(port('out_pc').map(d))},we:${name(port('we')[0])},address:${word(port('out_adr'))}};`)
    return new Function('a', 'pc', 'inst', 'm', code.join('\n')) as ReturnType<typeof logic>
}
const expected = (a: number, pc: number, inst: number, m: number) => ({
    a: inst >> 6 === 0 ? m : inst >> 6 === 2 ? (a - m) & 255 : a,
    pc: inst >> 6 === 3 && a === 0 ? inst & 63 : (pc + 1) & 63,
    we: inst >> 6 === 1, address: inst & 63
})

test('primitive truth tables and both independent Cross channels', () => {
    for (const kind of ['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'NOT', 'MUX'] as const) {
        const gate = new factories[kind]()
        for (let i = 0; i < 8; i++) {
            const a = Boolean(i & 1), b = Boolean(i & 2), s = Boolean(i & 4)
            gate.set('A', a); if (gate.pins.B) gate.set('B', b); if (gate.pins.S) gate.set('S', s); gate.update()
            const value = { AND: a && b, NAND: !(a && b), OR: a || b, NOR: !(a || b), XOR: a !== b, XNOR: a === b, NOT: !a, MUX: s ? b : a }[kind]
            assert.equal(gate.get('Y'), value, kind)
        }
    }
    for (const h of [false, true]) for (const v of [false, true]) {
        const cross = crossPart({ id: 'test', center: [0, 0], hNet: 'h', vNet: 'v', hForward: h, vForward: v })
        for (let n = 0; n < 4; n++) {
            cross.set('TL', Boolean(n & 1)); cross.set('TR', Boolean(n & 2)); cross.update()
            assert.equal(cross.get('BR'), Boolean(n & 1)); assert.equal(cross.get('BL'), Boolean(n & 2))
        }
    }
})

for (const spec of specs) test(`${spec.name}: all 65,536 subtraction pairs and every instruction encoding`, () => {
    const f = logic(spec)
    for (let a = 0; a < 256; a++) for (let m = 0; m < 256; m++) assert.deepEqual(f(a, 63, 128 | 37, m), expected(a, 63, 128 | 37, m))
    for (let inst = 0; inst < 256; inst++) for (let pc = 0; pc < 64; pc++) for (const a of [0, 1, 127, 128, 255]) {
        const m = (inst + a + pc) & 255
        assert.deepEqual(f(a, pc, inst, m), expected(a, pc, inst, m))
    }
})

function referenceStep(state: { a: number, pc: number }, mem: Uint8Array) {
    const inst = mem[state.pc], m = mem[inst & 63], next = expected(state.a, state.pc, inst, m)
    if (next.we) mem[next.address] = state.a
    state.a = next.a; state.pc = next.pc
}
for (const layout of layouts) {
    test(`${layout.spec.name}: physical geometry, primitive whitelist, single drivers, 14 dffs`, () => { assert.equal(audit(layout).errors, 0) })
    test(`${layout.spec.name}: six programs, compared with an independent model at EVERY edge`, () => {
        const { circuit, memory } = loadComputer(layout)
        for (const program of programs) {
            const p = assemble(program.source), mem = p.image.slice(), state = { a: 0, pc: 0 }; memory.load(p.image); circuit.reset()
            let cycles = 0
            while (!(state.pc === p.labels.halt && state.a === 0)) {
                assert(cycles++ < 500, program.id)
                const before = snapshot(memory)
                assert.deepEqual([before.pc, before.a, before.inst, before.operand, before.we], [state.pc, state.a, mem[state.pc], mem[mem[state.pc] & 63], mem[state.pc] >> 6 === 1])
                referenceStep(state, mem); circuit.tick()
                assert.deepEqual([snapshot(memory).a, snapshot(memory).pc], [state.a, state.pc], program.id)
                assert.deepEqual(memory.bytes, mem, program.id)
            }
            for (const [addr, value] of Object.entries(program.expected)) assert.equal(mem[Number(addr)], value, program.id)
        }
    })
    test(`${layout.spec.name}: 4,096 random-memory cycles, wraparound and self-modifying stores`, () => {
        const { circuit, memory } = loadComputer(layout)
        let seed = 192837
        const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0 }
        for (let trial = 0; trial < 32; trial++) {
            const mem = Uint8Array.from({ length: 64 }, () => rand() & 255), state = { a: 0, pc: 0 }
            memory.load(mem); circuit.reset()
            for (let i = 0; i < 128; i++) {
                referenceStep(state, mem); circuit.tick()
                assert.deepEqual([snapshot(memory).a, snapshot(memory).pc], [state.a, state.pc], `${trial}/${i}`)
                assert.deepEqual(memory.bytes, mem)
            }
        }
    })
}
test('route corruption is not hidden by logical net IDs', () => {
    const layout = structuredClone(layouts[0]), a = layout.terminals.find(t => t.id === 'inst[6]')!, b = layout.terminals.find(t => t.id === 'inst[7]')!
    layout.traces.push({ net: a.net, points: [[a.x, a.y], [a.x + 1, a.y], [a.x + 1, b.y], [b.x, b.y]] })
    assert.throws(() => loadComputer(layout), /short/)
})
test('assembler rejects invalid addresses, duplicate labels, overlapping images and bad bytes', () => {
    for (const source of ['LDA 64', 'LDA -1', 'x: .byte 0\nx: .byte 1', '.byte 1\n.org 0\n.byte 2', '.byte 256', 'LDA unknown']) assert.throws(() => assemble(source))
})

// Integration tests deliberately use only the native editor's public API.
test('native Circuit loads the original classes, views and pin definitions without overrides', () => {
    for (const layout of layouts) {
        const { circuit, memory } = loadComputer(layout)
        assert(circuit instanceof Circuit)
        assert(memory instanceof MemoryGate)
        assert.equal(circuit.gates.length, layout.cells.length + layout.bridges.length + 1)
        assert.equal(circuit.wires.length, layout.traces.length)
        for (const c of layout.cells) {
            const g = circuit.gates.find(g => g.item.name === c.id)!.item, original = new factories[c.kind]()
            assert.equal(Object.getPrototypeOf(g), Object.getPrototypeOf(original))
            assert.equal(g.view, original.view)
            assert.deepEqual(g.size, original.size)
            for (const pin in original.pins) assert.deepEqual(g.pins[pin].coord, original.pins[pin].coord)
        }
        for (const b of layout.bridges) {
            const g = circuit.gates.find(g => g.item.name === b.id)!.item, original = new Cross()
            assert(g instanceof Cross); assert.equal(g.view, original.view); assert.deepEqual(g.size, original.size)
            for (const pin in original.pins) assert.deepEqual(g.pins[pin].coord, original.pins[pin].coord)
        }
        assert(circuit.wires.every(w => w.item instanceof Wire))
        assert.equal(circuit.unconnected!.length, 0)
    }
})

test('ordinary Circuit.tick samples ALL DFFs before committing any, and Button changes only on click', () => {
    const c = new Circuit(), button = new Button('input'), q1 = new DFFGate('q1'), q2 = new DFFGate('q2'), lamp = new Lightbulb('out')
    c.add(button, [0, 0]).add(q1, [4, 0]).add(q2, [8, 0]).add(lamp, [12, 0])
    for (const x of [2, 6, 10]) c.add(new Wire([[x, 1], [x + 2, 1]]))
    c.update(); button.click(); c.update(); c.update()
    assert.equal(button.get('Y'), true)
    c.tick(); assert.deepEqual([q1.get('Q'), q2.get('Q'), lamp.get('A')], [true, false, false])
    c.tick(); assert.deepEqual([q1.get('Q'), q2.get('Q'), lamp.get('A')], [true, true, true])
    c.reset(); assert.deepEqual([q1.get('Q'), q2.get('Q')], [false, false])
})

test('moving a real DFF or erasing its real input wire breaks the CPU; logical net IDs cannot repair it', () => {
    for (const layout of layouts) {
        const { circuit, memory } = loadComputer(layout)
        const bit0 = layout.spec.ports.find(p => p.name === 'out_mem')!.bits[0]
        const cell = layout.cells.find(c => c.kind === 'DFF' && c.pins.Q === bit0)!
        const g = circuit.gates.find(g => g.item.name === cell.id)!, pin = circuit.pinPosition(g, 'D')
        const wires = circuit.wires.filter(w => w.item.has(pin))
        assert(wires.length > 0)
        for (const w of wires) circuit.remove(circuit.wires.indexOf(w), w.item)
        memory.load(assemble(programs[0].source).image); circuit.reset(); circuit.tick()
        assert.equal(snapshot(memory).a, 8, 'missing bit zero wire must turn LDA 9 into 8')
        assert(circuit.unconnected!.some(p => p.item === g.item && p.pin === 'D'))
        const restored = loadComputer(layout)
        restored.memory.load(assemble(programs[0].source).image); restored.circuit.reset(); restored.circuit.tick()
        assert.equal(snapshot(restored.memory).a, 9)
        const moved = restored.circuit.gates.find(g => g.item.name === cell.id)!
        moved.coords = coord([layout.width + 10, 0]); restored.circuit.invalidate(); restored.circuit.reset(); restored.circuit.tick()
        assert.equal(snapshot(restored.memory).a, 8)
    }
})

test('native half-adder remains correct with the existing editor junction convention', () => {
    const c = new Circuit(), a = new Button('a'), b = new Button('b'), xor = new factories.XOR(), and = new factories.AND(), sum = new Lightbulb('sum'), carry = new Lightbulb('carry')
    c.add(a, [1, 1]).add(b, [1, 4]).add(xor, [7, 2]).add(and, [7, 5]).add(sum, [10, 2]).add(carry, [10, 5])
    for (const path of [[[3,2],[7,2]], [[3,5],[7,5]], [[5,2],[5,7],[7,7]], [[6,5],[6,4],[7,4]], [[9,3],[10,3]], [[9,6],[10,6]]]) c.add(new Wire(path as [number, number][]))
    for (let i = 0; i < 4; i++) {
        a.set('Y', Boolean(i & 1)); b.set('Y', Boolean(i & 2)); c.update()
        assert.deepEqual(c.errors, [])
        assert.equal(sum.get('A'), Boolean(i === 1 || i === 2))
        assert.equal(carry.get('A'), i === 3)
    }
})

test('zero-length segments do not connect unrelated points', () => {
    assert.equal(new Wire([[0, 0], [0, 0]]).has(coord([2, 3])), false)
})
