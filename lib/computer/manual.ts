import { Cell, Kind, Note, Placed, Spec, Terminal, bit, terminals } from './model'

export function manualComputer() {
    const cells: Placed[] = [], notes: Note[] = []
    const port = (name: string, count: number, direction: 'input' | 'output', nets = Array.from({ length: count }, (_, i) => bit(name, i))) => ({ name, direction, bits: nets })
    const a = Array.from({ length: 8 }, (_, i) => bit('a', i)), pc = Array.from({ length: 6 }, (_, i) => bit('pc', i))
    const inst = Array.from({ length: 8 }, (_, i) => bit('inst', i)), mem = Array.from({ length: 8 }, (_, i) => bit('in_mem', i))
    const gate = (id: string, kind: Kind, pins: Record<string, string>, x: number, y: number, label = id) => {
        cells.push({ id, kind, pins, x, y, label, ...(kind === 'DFF' ? { initial: false } : {}) })
        return pins.Y || pins.Q
    }
    gate('not.op6', 'NOT', { A: inst[6], Y: 'write.a' }, 12, 8)
    gate('not.op7', 'NOT', { A: inst[7], Y: 'not.op7' }, 12, 13)
    gate('store', 'AND', { A: 'not.op7', B: inst[6], Y: 'we' }, 20, 13)
    gate('is.jump', 'AND', { A: inst[6], B: inst[7], Y: 'is.jump' }, 20, 8)
    gate('take.jump', 'AND', { A: 'zero', B: 'is.jump', Y: 'take.jump' }, 40, 8)
    notes.push({ x: 4, y: 4, text: 'decode · 00 load / 01 store / 10 subtract / 11 jump if zero' })
    notes.push({ x: 4, y: 24, text: 'accumulator · eight repeated one-bit slices' })
    for (const [x, text] of [[22, 'a xor m'], [31, 'subtract'], [40, 'load / sub'], [49, 'hold / write'], [59, 'a · dff']] as const)
        notes.push({ x, y: 28, text })
    for (let i = 0; i < 8; i++) {
        const y = 32 + i * 11
        const pair = gate(`pair.${i}`, 'XOR', { A: a[i], B: mem[i], Y: `pair.${i}` }, 23, y)
        const diff = i === 0 ? pair : gate(`diff.${i}`, 'XOR', { A: pair, B: `borrow.${i - 1}`, Y: `diff.${i}` }, 32, y)
        if (i === 0) {
            gate('not.a0', 'NOT', { A: a[0], Y: 'not.a0' }, 23, y + 5)
            gate('borrow.0', 'AND', { A: 'not.a0', B: mem[0], Y: 'borrow.0' }, 32, y + 5)
        } else if (i < 7) gate(`borrow.${i}`, 'MUX', { A: `borrow.${i - 1}`, B: mem[i], S: pair, Y: `borrow.${i}` }, 32, y + 4)
        // If bits differ, borrow-out is m; otherwise it is borrow-in.
        gate(`load.sub.${i}`, 'MUX', { A: mem[i], B: diff, S: inst[7], Y: `alu.${i}` }, 41, y)
        gate(`hold.${i}`, 'MUX', { A: a[i], B: `alu.${i}`, S: 'write.a', Y: `next.a.${i}` }, 50, y)
        gate(`a.${i}`, 'DFF', { D: `next.a.${i}`, Q: a[i], C: 'clk[0]' }, 60, y + 1)
        notes.push({ x: 4, y: y + 1, text: `bit ${i}` })
    }
    notes.push({ x: 4, y: 125, text: 'zero detector · nor of all eight accumulator bits' })
    for (let i = 0; i < 4; i++) gate(`zero.pair.${i}`, 'OR', { A: a[i * 2], B: a[i * 2 + 1], Y: `zero.pair.${i}` }, 18 + i * 9, 130)
    gate('zero.lo', 'OR', { A: 'zero.pair.0', B: 'zero.pair.1', Y: 'zero.lo' }, 27, 138)
    gate('zero.hi', 'OR', { A: 'zero.pair.2', B: 'zero.pair.3', Y: 'zero.hi' }, 45, 138)
    gate('zero', 'NOR', { A: 'zero.lo', B: 'zero.hi', Y: 'zero' }, 54, 143)
    notes.push({ x: 4, y: 153, text: 'program counter · increment, or take the six-bit jump address' })
    for (let i = 0; i < 6; i++) {
        const y = 160 + i * 9
        if (i === 0) gate('increment.0', 'NOT', { A: pc[0], Y: 'inc.0' }, 30, y)
        else {
            gate(`increment.${i}`, 'XOR', { A: pc[i], B: i === 1 ? pc[0] : `carry.${i}`, Y: `inc.${i}` }, 30, y)
            if (i < 5) gate(`carry.${i + 1}`, 'AND', { A: pc[i], B: i === 1 ? pc[0] : `carry.${i}`, Y: `carry.${i + 1}` }, 22, y + 3)
        }
        gate(`pc.select.${i}`, 'MUX', { A: `inc.${i}`, B: inst[i], S: 'take.jump', Y: `next.pc.${i}` }, 43, y)
        gate(`pc.${i}`, 'DFF', { D: `next.pc.${i}`, Q: pc[i], C: 'clk[0]' }, 60, y + 1)
    }
    // Put the counter beside the accumulator, not a screen-length below it.
    for (const c of cells) {
        if (/^(increment|carry|pc\.)/.test(c.id)) { c.x += 74; c.y -= 128 }
        if (/^zero/.test(c.id)) { c.x += 72; c.y -= 31 }
    }
    for (const n of notes) {
        if (n.text.startsWith('program counter')) { n.x = 84; n.y = 24 }
        if (n.text.startsWith('zero detector')) { n.x = 84; n.y = 94 }
    }
    const spec: Spec = { name: 'hand-built', cells: cells.map(({ x: _x, y: _y, ...c }): Cell => c), ports: [
        port('clk', 1, 'input'), port('inst', 8, 'input', inst), port('in_mem', 8, 'input', mem),
        port('we', 1, 'output', ['we']), port('out_mem', 8, 'output', a),
        port('out_adr', 6, 'output', inst.slice(0, 6)), port('out_pc', 6, 'output', pc)
    ] }
    const ts: Terminal[] = terminals(spec)
    for (const t of ts) {
        const i = Number(t.id.match(/\[(\d+)\]/)?.[1] || 0)
        if (t.id.startsWith('inst[')) { t.x = i < 6 ? 84 : 5; t.y = i < 6 ? 32 + i * 9 : 8 + (i - 6) * 5 }
        if (t.id.startsWith('in_mem')) { t.x = 10; t.y = 34 + i * 11 }
        if (t.id.startsWith('out_mem')) { t.x = 72; t.y = 34 + i * 11 }
        if (t.id.startsWith('out_pc')) { t.x = 146; t.y = 34 + i * 9 }
        if (t.id.startsWith('out_adr')) { t.x = 84; t.y = 32 + i * 9 }
        if (t.id.startsWith('we')) { t.x = 72; t.y = 15 }
    }
    return { spec, cells, terminals: ts, notes }
}
