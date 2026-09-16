export const opcodes = { LDA: 0, STA: 1, SUB: 2, JZ: 3 } as const
export const decode = (inst: number) => `${Object.keys(opcodes)[inst >> 6].toLowerCase()} ${inst & 63}`
export type Program = { id: string, title: string, description: string, source: string, expected: Record<number, number> }
export function assemble(source: string) {
    const labels: Record<string, number> = {}, lines = source.split('\n').map(s => s.split(';')[0].trim())
    const image = new Uint8Array(64), used = new Set<number>(), listing: { address: number, text: string, byte: number }[] = []
    let pc = 0
    const value = (s: string) => {
        const n = labels[s] ?? Number(s)
        if (!Number.isInteger(n)) throw Error(`unknown value: ${s}`)
        return n
    }
    for (let pass = 0; pass < 2; pass++) {
        pc = 0
        for (const raw of lines) {
            if (!raw) continue
            let text = raw
            const match = /^([\w.]+):\s*(.*)$/.exec(text)
            if (match) {
                if (pass === 0) {
                    if (Object.hasOwn(labels, match[1])) throw Error(`duplicate label: ${match[1]}`)
                    labels[match[1]] = pc
                }
                text = match[2]
            }
            if (!text) continue
            const [mnemonic, operand, extra] = text.split(/\s+/)
            if (extra || operand === undefined) throw Error(`expected an opcode and operand: ${text}`)
            if (mnemonic === '.org') { pc = value(operand); continue }
            if (pc < 0 || pc > 63) throw Error(`address outside memory: ${pc}`)
            if (pass === 1) {
                if (used.has(pc)) throw Error(`overlapping program at ${pc}`)
                used.add(pc)
                const n = value(operand)
                let byte: number
                if (mnemonic === '.byte') {
                    if (n < -128 || n > 255) throw Error('byte out of range')
                    byte = n & 255
                } else {
                    const op = opcodes[mnemonic.toUpperCase() as keyof typeof opcodes]
                    if (op === undefined || n < 0 || n > 63) throw Error(`invalid instruction: ${text}`)
                    byte = op << 6 | n
                }
                image[pc] = byte; listing.push({ address: pc, text: raw, byte })
            }
            pc++
        }
    }
    return { image, labels, listing }
}
export const programs: Program[] = [
    { id: 'subtract', title: '9 − 4 = 5', description: 'load, subtract, store; then park in a zero-branch loop.', expected: { 52: 5 }, source: `
LDA x
SUB y
STA answer
LDA zero
halt: JZ halt
.org 50
x: .byte 9
y: .byte 4
answer: .byte 0
zero: .byte 0` },
    { id: 'countdown', title: 'count down from 10', description: 'watch memory[50] change on each store. zero makes the exit branch fire.', expected: { 50: 0 }, source: `
loop: LDA counter
SUB one
STA counter
JZ done
LDA zero
JZ loop
done: LDA zero
halt: JZ halt
.org 50
counter: .byte 10
one: .byte 1
zero: .byte 0` },
    { id: 'add', title: 'add using subtraction', description: 'form −y in scratch memory, then compute x − (−y).', expected: { 52: 12, 53: 251 }, source: `
LDA zero
SUB y
STA negative_y
LDA x
SUB negative_y
STA answer
LDA zero
halt: JZ halt
.org 50
x: .byte 7
y: .byte 5
answer: .byte 0
negative_y: .byte 0
zero: .byte 0` },
    { id: 'multiply', title: '6 × 7 = 42', description: 'a loop adds seven six times. every addition is a subtraction of −7.', expected: { 52: 42, 53: 0 }, source: `
LDA zero
SUB y
STA negative_y
LDA x
STA counter
loop: LDA counter
JZ done
SUB one
STA counter
LDA answer
SUB negative_y
STA answer
LDA zero
JZ loop
done: LDA zero
halt: JZ halt
.org 50
x: .byte 6
y: .byte 7
answer: .byte 0
counter: .byte 0
negative_y: .byte 0
one: .byte 1
zero: .byte 0` },
    { id: 'wrap', title: '0 − 1 wraps to 255', description: 'eight-bit arithmetic discards the borrow; there is no carry flag.', expected: { 52: 255 }, source: `
LDA zero
SUB one
STA answer
LDA zero
halt: JZ halt
.org 50
zero: .byte 0
one: .byte 1
answer: .byte 0` },
    { id: 'selfmodify', title: 'rewrite a future instruction', description: 'store replaces a future LDA with a JZ. writes use the old address and data at the edge.', expected: { 4: 198, 52: 0 }, source: `
LDA patch
STA patched
LDA zero
JZ patched
patched: LDA bad
STA answer
landing: LDA zero
halt: JZ halt
.org 50
patch: .byte 198
bad: .byte 99
answer: .byte 0
zero: .byte 0` }
]
