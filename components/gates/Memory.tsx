import { Gate, GateView } from "./core/Gate"
import { GateViewProps, PinDecl } from "./core/types"

const MemoryView = (props: GateViewProps) => <GateView {...props}>
    <rect width={props.gate.size.x} height={props.gate.size.y} fill={props.hover ? '#333' : '#171717'} stroke="#999" strokeWidth={.08}/>
    <text x={props.gate.size.x/2} y={props.gate.size.y/2} fill="#eee" textAnchor="middle" fontSize={1}>64 × 8</text>
    <text x={props.gate.size.x/2} y={props.gate.size.y/2+1.5} fill="#aaa" textAnchor="middle" fontSize={.6}>shared ram</text>
    {Object.entries(props.gate.pins).map(([name,p]) => <text key={name} x={p.type==='in'?.4:props.gate.size.x-.4}
        y={p.coord.y+.2} fill="#aaa" textAnchor={p.type==='in'?'start':'end'} fontSize={.5}>{name.toLowerCase()}</text>)}
</GateView>
export class Memory extends Gate {
    static type = 'Memory'
    bytes = new Uint8Array(64)
    private clock = false
    private pending: [number,number] | undefined
    cycles = 0
    writes = 0
    lastWrite: number | undefined
    constructor(name = 'memory', image?: Uint8Array, pitch=1.5) {
        const pins: PinDecl = {}
        let y=1
        for(const [prefix,size] of [['PC',6],['AD',6],['W',8]] as const)
            for(let i=0;i<size;i++) pins[`${prefix}${i}`]={type:'in',coord:[0,(y++)*pitch]}
        for(const name of ['WE','CLK']) pins[name]={type:'in',coord:[0,(y++)*pitch]}
        for(let i=0;i<8;i++) {
            pins[`I${i}`]={type:'out',coord:[5*pitch,(1+i)*pitch]}
            pins[`R${i}`]={type:'out',coord:[5*pitch,(14+i)*pitch]}
        }
        super(name,[5*pitch,24*pitch],pins,MemoryView)
        if(image) {if(image.length!==64) throw Error('expected 64 bytes'); this.bytes.set(image)}
    }
    word(prefix: string, count: number) {
        let n=0; for(let i=0;i<count;i++) if(this.get(`${prefix}${i}`)) n|=1<<i
        return n
    }
    update() {
        let changed=false
        const inst=this.bytes[this.word('PC',6)], data=this.bytes[this.word('AD',6)]
        for(let i=0;i<8;i++) {
            changed=this.set(`I${i}`,!!(inst&(1<<i)))||changed
            changed=this.set(`R${i}`,!!(data&(1<<i)))||changed
        }
        return changed
    }
    sample() {
        const clock=!!this.get('CLK')
        if(clock&&!this.clock)this.cycles++
        this.pending=clock&&!this.clock&&this.get('WE')?[this.word('AD',6),this.word('W',8)]:undefined
        this.clock=clock
    }
    commit() {
        if(!this.pending) return false
        const [address,data]=this.pending;this.pending=undefined
        this.bytes[address]=data;this.lastWrite=address;this.writes++
        return true
    }
}
