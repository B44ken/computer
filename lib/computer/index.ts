import { Circuit } from '../circuit'
import { coord, Coord } from '../coord'
import { Gate } from '../../components/gates/core/Gate'
import { Wire } from '../../components/gates/core/Wire'
import { ANDGate } from '../../components/gates/ANDGate'
import { ORGate } from '../../components/gates/ORGate'
import { NORGate } from '../../components/gates/NORGate'
import { XORGate } from '../../components/gates/XORGate'
import { NOTGate } from '../../components/gates/NOTGate'
import { MUXGate } from '../../components/gates/MUXGate'
import { DFFGate } from '../../components/gates/DFFGate'
import { Cross } from '../../components/gates/Cross'
import { Button } from '../../components/gates/Button'
import { Memory } from '../../components/gates/Memory'
import { describeCPU } from './description'
import { place, route } from './routing'

export type Variant = 'manual' | 'auto'
export type BuildNode = {id: string, gate: Gate, signals: Record<string,string>, x: number, y: number, w: number, h: number, group?: string, bit?: number, col?: number}
const constructors = {AND:ANDGate,OR:ORGate,NOR:NORGate,XOR:XORGate,NOT:NOTGate,MUX:MUXGate,DFF:DFFGate}
const pointKey = (p: number[]) => p.map(n=>Math.round(n*1e8)/1e8).join(',')

export function buildComputer(variant: Variant = 'manual') {
    const description = describeCPU(variant), circuit = new Circuit(), memory = new Memory(), clock = new Button('clock')
    const nodes: BuildNode[] = description.cells.map(c => {
        const gate: Gate = new constructors[c.type](c.type === 'DFF' ? c.id.replace(/[\[\]]/g,'') : undefined)
        const names = c.type === 'DFF' ? ['D','CLK'] : c.type === 'MUX' ? ['A','B','S'] : ['A','B']
        const signals = Object.fromEntries(c.inputs.map((n,i)=>[names[i],n]))
        signals[c.type === 'DFF' ? 'Q' : 'Y'] = c.output
        return {...c,gate,signals,x:0,y:0,w:gate.size.x,h:gate.size.y}
    })
    const memorySignals: Record<string,string> = {WE:'we',CLK:'clk'}
    for(let i=0;i<8;i++){memorySignals[`I${i}`]=`inst[${i}]`;memorySignals[`M${i}`]=`data[${i}]`;memorySignals[`D${i}`]=`a[${i}]`}
    for(let i=0;i<6;i++){memorySignals[`PC${i}`]=`pc[${i}]`;memorySignals[`ADR${i}`]=`inst[${i}]`}
    nodes.push({id:'memory',gate:memory,signals:memorySignals,x:0,y:0,w:10,h:80}, {id:'clock',gate:clock,signals:{Y:'clk'},x:0,y:0,w:2,h:2})
    const layout = route(place(nodes, variant))
    const crossPorts = new Map<string, Map<string, Coord>>()
    for(const n of nodes)circuit.add(n.gate,[n.x,n.y])
    for(const cross of layout.crosses) {
        const gate = new Cross()
        gate.rotation = cross.rotation
        gate.transformScale = .45
        const origin = coord([cross.x-.5,cross.y-.5])
        circuit.add(gate, origin)
        crossPorts.set(pointKey([cross.x,cross.y]),new Map(Object.keys(gate.pins).map(pin=>{
            const p=gate.pinPosition(pin,origin),dx=p.x-cross.x,dy=p.y-cross.y
            return [Math.abs(dx)>Math.abs(dy)?dx<0?'W':'E':dy<0?'N':'S',p]
        })))
    }
    // Turn actual routed segments into the editor's Wire polylines. At a Cross,
    // cut each track at the ACTUAL rotated pin position (no net-id shortcut).
    const graph = new Map<string, {p:number[],edges:any[]} >()
    const terminals = new Set(layout.pins.map(p=>pointKey([p.x,p.y])))
    for(const c of layout.crosses)terminals.add(pointKey([c.x,c.y]))
    for(const e of layout.edges)for(const p of [e.a,e.b]){
        const k=pointKey(p);if(!graph.has(k))graph.set(k,{p,edges:[]});graph.get(k)!.edges.push(e)
    }
    const seen=new Set(),adjust=(p:number[],toward:number[])=>{
        const ports=crossPorts.get(pointKey(p));if(!ports)return coord(p as [number,number])
        return ports.get(toward[0]!==p[0]?toward[0]<p[0]?'W':'E':toward[1]<p[1]?'N':'S')!
    }
    const boundary=(k:string)=>terminals.has(k)||graph.get(k)!.edges.length!==2
    for(const [key,node] of graph)if(boundary(key))for(const first of node.edges){
        if(seen.has(first))continue
        let e=first,from=node.p,points: number[][]=[from]
        while(true){
            seen.add(e);const next=pointKey(e.a)===pointKey(from)?e.b:e.a;points.push(next)
            const k=pointKey(next);if(boundary(k))break
            const edges=graph.get(k)!.edges;e=edges[0]===e?edges[1]:edges[0];from=next
        }
        const coords=points.map(p=>coord(p as [number,number]))
        coords[0]=adjust(points[0],points[1]);coords[coords.length-1]=adjust(points.at(-1)!,points.at(-2)!)
        circuit.add(new Wire(coords))
    }
    if(seen.size!==layout.edges.length)throw Error('floating routing loop')
    circuit.annotations=layout.groups.map(g=>({text:g.title,x:g.x,y:g.y-3,width:g.w,height:g.h+3}))
    circuit.buildConnections()
    if(circuit.unconnected!.length)throw Error('unconnected pins: '+circuit.unconnected!.map(p=>`${p.item.type}.${p.pin}`).join(','))
    const cpu = {variant,circuit,memory,clock,nodes,layout,cycles:0,
        a:nodes.filter(n=>/^a\[/.test(n.id)).map(n=>n.gate as DFFGate),
        pc:nodes.filter(n=>/^pc\[/.test(n.id)).map(n=>n.gate as DFFGate)}
    powerOn(cpu)
    return cpu
}
export type Computer = ReturnType<typeof buildComputer>
export const word = (gates: Gate[]) => gates.reduce((n,g,i)=>n+(g.get('Q')?1<<i:0),0)
export function powerOn(computer: Computer, image=new Uint8Array(64)) {
    computer.clock.set('Y',false)
    for(const gate of [...computer.a,...computer.pc])gate.powerOn()
    computer.memory.load(image);computer.cycles=0;computer.circuit.update()
}
export function step(computer: Computer) {
    computer.clock.set('Y',false);computer.circuit.update()
    computer.clock.set('Y',true);computer.circuit.update()
    computer.clock.set('Y',false);computer.circuit.update()
    computer.cycles++
}
