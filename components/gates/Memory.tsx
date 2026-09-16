import { Gate, GateView } from "./core/Gate"
import { GateViewProps, PinDecl } from "./core/types"

export const MemoryView = (props: GateViewProps) => <GateView {...props}>
    <rect width={10} height={80} fill={props.hover ? '#292929' : '#111'} stroke="#999" strokeWidth={0.08} />
    <text x={5} y={-1.8} textAnchor="middle" fill="#555" fontSize={1.5}>64 × 8 memory</text>
    {Object.entries(props.gate.pins).map(([name, pin]) => <text key={name} x={pin.type === 'in' ? .45 : 9.55} y={pin.coord.y + .25}
        textAnchor={pin.type === 'in' ? 'start' : 'end'} fill="#aaa" fontSize={.8}>{name.toLowerCase()}</text>)}
</GateView>

export class Memory extends Gate {
    static type = "Memory"
    sequential = true
    readonly bytes = new Uint8Array(64)
    private clock = false
    private pending: { address: number, data: number } | undefined
    lastWrite: number | null = null
    constructor(name = 'memory') {
        const pins: PinDecl = {}
        let n = 0
        for (const [prefix, width] of [['PC', 6], ['ADR', 6], ['D', 8]] as const)
            for (let i = 0; i < width; i++) pins[`${prefix}${i}`] = { type: 'in', coord: [0, 2 + 3 * n++] }
        for (const name of ['WE', 'CLK']) pins[name] = { type: 'in', coord: [0, 2 + 3 * n++] }
        for (let i = 0; i < 8; i++) {
            pins[`I${i}`] = { type: 'out', coord: [10, 2 + 2 * i] }
            pins[`M${i}`] = { type: 'out', coord: [10, 18 + 8 * i] }
        }
        super(name, [10, 80], pins, MemoryView)
    }
    private word(prefix: string, n: number) { let v = 0; for (let i = 0; i < n; i++) if (this.get(`${prefix}${i}`)) v |= 1 << i; return v }
    load(image = new Uint8Array(64)) {
        if (image.length !== 64) throw Error('memory must contain 64 bytes')
        this.bytes.set(image); this.clock = false; this.pending = undefined; this.lastWrite = null
    }
    update() {
        let changed = false
        for (const [prefix, value] of [['I', this.bytes[this.word('PC', 6)]], ['M', this.bytes[this.word('ADR', 6)]]] as const)
            for (let i = 0; i < 8; i++) changed = this.set(`${prefix}${i}`, !!(value & (1 << i))) || changed
        return changed
    }
    sample() {
        const clock = !!this.get('CLK')
        this.pending = clock && !this.clock && this.get('WE') ? { address: this.word('ADR', 6), data: this.word('D', 8) } : undefined
        this.clock = clock
    }
    commit() {
        if (!this.pending) return false
        const { address, data } = this.pending
        this.lastWrite = address; this.bytes[address] = data
        return true
    }
}
