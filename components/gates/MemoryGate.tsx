import { Gate, GateView } from './core/Gate'
import { GateViewProps, PinDecl } from './core/types'

export const MemoryGateView = (props: GateViewProps) => {
    const memory = props.gate as MemoryGate
    return <GateView {...props}>
        <rect width={8} height={96} rx={0.5} fill={props.hover ? '#222' : '#000'} stroke="#999" strokeWidth={0.08}/>
        <text transform="translate(1.8,48) rotate(-90)" textAnchor="middle" fill="#bbb" fontSize={1.2}>64 × 8 · shared code / data memory</text>
        {Object.entries(memory.pins).map(([name, pin]) => <text key={name} x={pin.coord.x === 0 ? 0.45 : 7.55} y={pin.coord.y + 0.25}
            textAnchor={pin.coord.x === 0 ? 'start' : 'end'} fill="#999" fontSize={0.66}>{name.replace('out_', '').replace('in_mem', 'data').replace('mem', 'write')}</text>)}
    </GateView>
}

// The one permitted high-level component. It contains memory operations,
// never instruction decoding, accumulator arithmetic, or program-counter state.
export class MemoryGate extends Gate {
    static type = 'Memory'
    bytes = new Uint8Array(64)
    image = new Uint8Array(64)
    nextWrite: { address: number, value: number } | null = null
    lastWrite: { address: number, value: number } | null = null
    constructor(constants: string[] = []) {
        const pins: PinDecl = {}
        const pin = (name: string, i: number, y: number, type: 'in' | 'out') => { pins[`${name}[${i}]`] = { type, coord: [8, y] } }
        for (let i = 0; i < 8; i++) {
            pin('in_mem', i, 6 + i * 11, 'out'); pin('out_mem', i, 8 + i * 11, 'in')
            pin('inst', i, 10 + i * 11, 'out')
            if (i < 6) { pin('out_adr', i, 12 + i * 11, 'in'); pin('out_pc', i, 14 + i * 11, 'in') }
        }
        pin('we', 0, 90, 'in')
        constants.forEach((net, i) => { pins[net] = { type: 'out', coord: [8, 92 + i * 2] } })
        super('memory', [8, 96], pins, MemoryGateView)
        for (const p in pins) this.set(p, false)
    }
    readBus(name: string, width: number) {
        let value = 0
        for (let i = 0; i < width; i++) if (this.get(`${name}[${i}]`)) value |= 1 << i
        return value
    }
    private writeBus(name: string, value: number) {
        let changed = false
        for (let i = 0; i < 8; i++) changed = this.set(`${name}[${i}]`, Boolean(value & (1 << i))) || changed
        return changed
    }
    update() {
        let changed = this.writeBus('inst', this.bytes[this.readBus('out_pc', 6)])
        changed = this.writeBus('in_mem', this.bytes[this.readBus('out_adr', 6)]) || changed
        for (const net of ['0', '1']) if (this.pins[net]) changed = this.set(net, net === '1') || changed
        return changed
    }
    sample() { this.nextWrite = this.get('we[0]') ? { address: this.readBus('out_adr', 6), value: this.readBus('out_mem', 8) } : null }
    commit() {
        this.lastWrite = this.nextWrite
        if (!this.nextWrite) return false
        const { address, value } = this.nextWrite, changed = this.bytes[address] !== value
        this.bytes[address] = value
        return changed
    }
    load(image: ArrayLike<number>) {
        if (image.length > 64) throw Error('memory image exceeds 64 bytes')
        this.image.fill(0); this.image.set(Array.from(image)); this.reset()
    }
    reset() { this.bytes.set(this.image); this.nextWrite = this.lastWrite = null }
}
