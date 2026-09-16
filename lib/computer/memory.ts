import { Gate } from '../../components/gates/core/Gate'
import { PinDecl } from '../../components/gates/core/types'
import { bit, Terminal } from './model'

export class MemoryInterface extends Gate {
    bytes = new Uint8Array(64)
    constructor(terminals: Terminal[]) {
        const pins: PinDecl = Object.fromEntries(terminals.map(t => [t.id, { type: t.source ? 'out' : 'in', coord: [t.x, t.y] }]))
        super('memory', [1, 1], pins, () => null)
        for (const p in pins) this.set(p, false)
    }
    readBus(name: string, width: number) {
        let result = 0
        for (let i = 0; i < width; i++) if (this.get(bit(name, i))) result |= 1 << i
        return result
    }
    writeBus(name: string, width: number, value: number) {
        let changed = false
        for (let i = 0; i < width; i++) changed = this.set(bit(name, i), Boolean(value & (1 << i))) || changed
        return changed
    }
    update() {
        let changed = this.writeBus('inst', 8, this.bytes[this.readBus('out_pc', 6)])
        changed = this.writeBus('in_mem', 8, this.bytes[this.readBus('out_adr', 6)]) || changed
        for (const c of ['0', '1']) if (this.pins[c]) changed = this.set(c, c === '1') || changed
        return changed
    }
    // Called once at the shared rising edge, using the OLD settled outputs.
    store() {
        if (!this.get('we[0]')) return null
        const address = this.readBus('out_adr', 6), value = this.readBus('out_mem', 8)
        this.bytes[address] = value
        return { address, value }
    }
}
