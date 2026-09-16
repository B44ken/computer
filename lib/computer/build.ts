import { Circuit } from '../circuit'
import { Coord, coord } from '../coord'
import { Gate } from '../../components/gates/core/Gate'
import { Wire } from '../../components/gates/core/Wire'
import { ANDGate } from '../../components/gates/ANDGate'
import { ORGate } from '../../components/gates/ORGate'
import { NORGate } from '../../components/gates/NORGate'
import { XORGate } from '../../components/gates/XORGate'
import { NOTGate } from '../../components/gates/NOTGate'
import { MUXGate } from '../../components/gates/MUXGate'
import { DFF } from '../../components/gates/DFF'
import { Cross } from '../../components/gates/Cross'
import { Button } from '../../components/gates/Button'
import { Memory } from '../../components/gates/Memory'
import { buildCPU } from './netlist'
import { route } from './router'

export type Variant = 'manual' | 'auto'
export type Annotation = {title:string,x:number,y:number,w:number,h:number}
type Cell = { id:string,type:string,inputs:string[],output:string,group:string,bit:number,col:number }
export type PinSpec = {node:string,pin:string,net:string,x:number,y:number,dir:number,output:boolean}
export type NativeComputer = ReturnType<typeof buildComputer>
const constructors = { AND:ANDGate, OR:ORGate, NOR:NORGate, XOR:XORGate, NOT:NOTGate, MUX:MUXGate, DFF }
const pinOrder = {NOT:['A'],MUX:['A','B','S'],DFF:['D','CLK']}
const SCALE = 1.5
const key = (x:number,y:number)=>`${x},${y}`

export function buildComputer(variant:Variant='manual', image=new Uint8Array(64), options={seed:12903,pitch:10}) {
    // This is a construction recipe ONLY. There is no CPU interpreter: every
    // operation below becomes a real Gate, and all execution is Circuit.update().
    const recipe=buildCPU(), cells=recipe.cells as Cell[]
    const circuit=new Circuit(), byName=new Map<string,Gate>(), memory=new Memory('memory',image), clock=new Button('clock')
    clock.set('Y',false)
    for(const c of cells) byName.set(c.id,new constructors[c.type](c.id))
    byName.set('memory',memory);byName.set('clock',clock)
    const groups:Annotation[]=variant==='manual' ? [
        {title:'invert / ripple subtract',x:20,y:12,w:27,h:58},
        {title:'load / hold / accumulator',x:52,y:12,w:21,h:58},
        {title:'zero detector',x:78,y:10,w:21,h:34},
        {title:'increment / jump / pc',x:20,y:83,w:27,h:43},
        {title:'opcode / branch',x:78,y:83,w:18,h:29}
    ]:[]
    const nodes=cells.map(c=>{
        const gate=byName.get(c.id)!
        let x=0,y=0
        if(c.group==='alu'){x=22+c.col*7;y=15+c.bit*7}
        if(c.group==='acc'){x=54+c.col*7;y=15+c.bit*7}
        if(c.group==='zero'){x=80+c.col*7;y=14+c.bit*7}
        if(c.group==='pc'){x=22+c.col*7;y=86+c.bit*7}
        if(c.group==='decode'){x=80;y=86+c.bit*7}
        return {...c,x,y,w:gate.size.x,h:gate.size.y}
    })
    const memoryNode={id:'memory',type:'Memory',x:7,y:8,w:memory.size.x/SCALE,h:memory.size.y/SCALE}
    const clockNode={id:'clock',type:'Button',x:3,y:3,w:2,h:2}
    const bindings=new Map<string,Record<string,string>>()
    for(const c of cells) bindings.set(c.id,Object.fromEntries([
        ...c.inputs.map((net,i)=>[(pinOrder[c.type]||['A','B'])[i],net]),[c.type==='DFF'?'Q':'Y',c.output]
    ]))
    bindings.set('clock',{Y:'clk'})
    const mem:Record<string,string>={WE:'we',CLK:'clk'}
    for(let i=0;i<6;i++){mem[`PC${i}`]=`pc[${i}]`;mem[`AD${i}`]=`inst[${i}]`}
    for(let i=0;i<8;i++){mem[`W${i}`]=`a[${i}]`;mem[`I${i}`]=`inst[${i}]`;mem[`R${i}`]=`data[${i}]`}
    bindings.set('memory',mem)
    const pinsFor=(node:{id:string,x:number,y:number}):PinSpec[]=>Object.entries(byName.get(node.id)!.pins).map(([pin,p])=>({
        node:node.id,pin,net:bindings.get(node.id)![pin],x:node.x+p.coord.x/(node.id==='memory'?SCALE:1),y:node.y+p.coord.y/(node.id==='memory'?SCALE:1),
        dir:p.type==='out'?1:pin==='CLK'&&node.id!=='memory'||pin==='S'?3:0,output:p.type==='out'
    }))
    if(variant==='auto') {
        // A shared network makes the area comparison about routing, not a different CPU.
        const slots=Array.from({length:88},(_,i)=>({x:20+i%8*options.pitch,y:8+Math.floor(i/8)*options.pitch}))
        const placed:any[]=[...nodes,...Array.from({length:slots.length-nodes.length},(_,i)=>({id:`empty${i}`}))]
        placed.forEach((c,i)=>Object.assign(c,slots[i]))
        const nets=new Map<string,{node:any,pin:Coord}[]>()
        for(const node of [...nodes,memoryNode,clockNode]) for(const p of pinsFor(node)) {
            if(!nets.has(p.net))nets.set(p.net,[])
            nets.get(p.net)!.push({node,pin:coord([p.x-node.x,p.y-node.y])})
        }
        const cost=(net:string)=>{
            const ps=nets.get(net)||[],xs=ps.map(p=>p.node.x+p.pin.x),ys=ps.map(p=>p.node.y+p.pin.y)
            return Math.max(...xs)-Math.min(...xs)+Math.max(...ys)-Math.min(...ys)
        }
        let seed=options.seed
        const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
        const swap=(a:any,b:any)=>{[a.x,b.x]=[b.x,a.x];[a.y,b.y]=[b.y,a.y]}
        for(let k=0;k<22000;k++) {
            const a=placed[Math.floor(rand()*placed.length)],b=placed[Math.floor(rand()*placed.length)]
            if(a===b)continue
            const affected=[...new Set([...Object.values(bindings.get(a.id)||{}),...Object.values(bindings.get(b.id)||{})])]
            const before=affected.reduce((s,n)=>s+cost(n),0);swap(a,b)
            const delta=affected.reduce((s,n)=>s+cost(n),0)-before,temp=12*Math.pow(.02,k/22000)
            if(delta>0&&rand()>Math.exp(-delta/temp))swap(a,b)
        }
    }
    const allNodes=[...nodes,memoryNode,clockNode]
    for(const n of allNodes)n.x+=22
    for(const g of groups)g.x+=22
    const pins=allNodes.flatMap(pinsFor)
    const placement={variant,nodes:allNodes,groups,pins,width:variant==='manual'?131:50+8*options.pitch,height:variant==='manual'?137:24+11*options.pitch}
    const routed=route(placement)
    for(const node of allNodes)circuit.add(byName.get(node.id)!,[node.x*SCALE,node.y*SCALE])
    // Each crossing becomes the actual 1x1 Cross gate. Its original diagonal
    // channels get short diagonal leads, NOT shrunken replacement gate art.
    const crosses=new Map<string,{gate:Gate,ports:Record<string,Coord>}>()
    for(const original of routed.crosses) {
        const c={...original,x:original.x*SCALE,y:original.y*SCALE}
        const gate=new Cross(''),turns=({[-45]:0,45:1,135:2,225:3})[c.rotation]
        for(const p of Object.values(gate.pins))for(let i=0;i<turns;i++)p.coord=coord([1-p.coord.y,p.coord.x])
        circuit.add(gate,[c.x-.5,c.y-.5])
        const sides=[['W','N','S','E'],['N','E','W','S'],['E','S','N','W'],['S','W','E','N']][turns]
        const names=['TL','TR','BL','BR'],ports:Record<string,Coord>={}
        names.forEach((name,i)=>ports[sides[i]]=gate.pins[name].coord.add([c.x-.5,c.y-.5]))
        crosses.set(key(c.x,c.y),{gate,ports})
    }
    // Cut at Cross pins and merge degree-two wire vertices into ordinary polylines.
    const graph=new Map<string,Set<string>>(),positions=new Map<string,Coord>(),edgeNets=new Map<string,string>()
    const edgeKey=(a:string,b:string)=>[a,b].sort().join('|')
    for(const e of routed.edges) {
        const endpoint=(a:number[],b:number[])=>{
            const cross=crosses.get(key(a[0]*SCALE,a[1]*SCALE));if(!cross)return coord([a[0]*SCALE,a[1]*SCALE])
            return cross.ports[b[0]<a[0]?'W':b[0]>a[0]?'E':b[1]<a[1]?'N':'S']
        }
        const a=endpoint(e.a,e.b),b=endpoint(e.b,e.a),ka=key(a.x,a.y),kb=key(b.x,b.y)
        positions.set(ka,a);positions.set(kb,b)
        for(const [p,q] of [[ka,kb],[kb,ka]]){if(!graph.has(p))graph.set(p,new Set());graph.get(p)!.add(q)}
        edgeNets.set(edgeKey(ka,kb),e.net)
    }
    const terminals=new Set(pins.map(p=>key(p.x*SCALE,p.y*SCALE)))
    for(const c of crosses.values())for(const p of Object.values(c.ports))terminals.add(key(p.x,p.y))
    const visited=new Set<string>(),wireSignals=new Map<Wire,string>()
    const walk=(start:string,next:string)=>{
        const path=[positions.get(start)!];let a=start,b=next
        while(true) {
            visited.add(edgeKey(a,b));path.push(positions.get(b)!)
            if(graph.get(b)!.size!==2||terminals.has(b))break
            const c=[...graph.get(b)!].find(v=>v!==a)!
            if(visited.has(edgeKey(b,c)))break
            a=b;b=c
        }
        const wire=new Wire(path);circuit.add(wire);wireSignals.set(wire,edgeNets.get(edgeKey(start,next))!)
    }
    for(const [v,neighbors] of graph)if(neighbors.size!==2||terminals.has(v))
        for(const n of neighbors)if(!visited.has(edgeKey(v,n)))walk(v,n)
    if(visited.size!==edgeNets.size)throw Error('unreachable wire loop')
    for(const p of pins) {
        if(p.node==='memory')continue
        const gate=byName.get(p.node)!,node=allNodes.find(n=>n.id===p.node)!
        const physical=gate.pins[p.pin].coord.add([node.x*SCALE,node.y*SCALE]),escape=coord([p.x*SCALE,p.y*SCALE])
        if(!physical.eq(escape)) {
            const wire=new Wire([physical,escape]);circuit.add(wire);wireSignals.set(wire,p.net)
        }
    }
    for(const g of groups){g.x*=SCALE;g.y*=SCALE;g.w*=SCALE;g.h*=SCALE}
    for(const p of pins){const node=allNodes.find(n=>n.id===p.node)!,pin=byName.get(p.node)!.pins[p.pin];p.x=node.x*SCALE+pin.coord.x;p.y=node.y*SCALE+pin.coord.y}
    circuit.buildConnections()
    const validation=validateNative(circuit,pins,byName)
    circuit.update()
    const points=circuit.gates.flatMap(g=>[g.coords,g.coords.add(g.item.size)]).concat(circuit.wires.flatMap(w=>w.item.path))
    const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y))
    const width=Math.max(...points.map(p=>p.x))-minX,height=Math.max(...points.map(p=>p.y))-minY
    const wireLength=circuit.wires.reduce((sum,w)=>sum+w.item.path.slice(1).reduce((s,p,i)=>s+p.sub(w.item.path[i]).len(),0),0)
    return {circuit,memory,clock,byName,pins,groups,variant,wireSignals,recipe,bounds:{x:minX,y:minY,width,height},
        metrics:{...routed.metrics,width,height,area:width*height,wireLength,gates:cells.length,crossovers:crosses.size,wires:circuit.wires.length},validation}
}

export function validateNative(circuit:Circuit,pins:PinSpec[],byName:Map<string,Gate>) {
    circuit.buildConnections()
    if(circuit.unconnected!.length)throw Error('undriven native inputs: '+circuit.unconnected!.map(p=>`${p.item.name}.${p.pin}`).join(', '))
    const source=new Map(pins.filter(p=>p.output).map(p=>[p.net,{item:byName.get(p.node)!,pin:p.pin}]))
    const inbound=new Map<Gate,Map<string,{item:Gate,pin:string}>>()
    for(const c of circuit.connections!) {
        if(!inbound.has(c.to))inbound.set(c.to,new Map())
        if(inbound.get(c.to)!.has(c.toPin))throw Error('multiple pin drivers')
        inbound.get(c.to)!.set(c.toPin,{item:c.from,pin:c.fromPin})
    }
    const resolve=(item:Gate,pin:string,seen=new Set<Gate>()):{item:Gate,pin:string}=>{
        const s=inbound.get(item)?.get(pin)
        if(!s)throw Error('open native pin')
        if(!(s.item instanceof Cross))return s
        if(seen.has(s.item))throw Error('crossover feedback')
        seen.add(s.item)
        return resolve(s.item,s.pin==='BR'?'TL':'TR',seen)
    }
    for(const p of pins.filter(p=>!p.output)) {
        const actual=resolve(byName.get(p.node)!,p.pin),expected=source.get(p.net)!
        if(actual.item!==expected.item||actual.pin!==expected.pin)throw Error(`misrouted ${p.node}.${p.pin}: expected ${p.net}`)
    }
    for(let i=0;i<circuit.gates.length;i++)for(let j=i+1;j<circuit.gates.length;j++){
        const a=circuit.gates[i],b=circuit.gates[j]
        if(a.coords.x<b.coords.x+b.item.size.x&&a.coords.x+a.item.size.x>b.coords.x&&a.coords.y<b.coords.y+b.item.size.y&&a.coords.y+a.item.size.y>b.coords.y)
            throw Error('overlapping native gates')
    }
    return {pins:pins.length,opens:0,shorts:0,overlaps:0}
}

export function readWord(gates:Map<string,Gate>,prefix:string,count:number) {
    let n=0;for(let i=0;i<count;i++)if(gates.get(`${prefix}[${i}]`)!.get('Q'))n|=1<<i
    return n
}
export function clockCycle(computer:NativeComputer) {
    computer.clock.set('Y',false);computer.circuit.update()
    computer.clock.set('Y',true);computer.circuit.update()
    computer.clock.set('Y',false);computer.circuit.update()
}

export function restartComputer(computer:NativeComputer,image:Uint8Array) {
    computer.clock.set('Y',false);computer.circuit.update()
    for(const {item} of computer.circuit.gates)if(item instanceof DFF)item.powerOn()
    computer.memory.bytes.set(image);computer.memory.cycles=0;computer.memory.writes=0;computer.memory.lastWrite=undefined
    computer.circuit.update()
}

export function traceWires(circuit:Circuit,item:Gate|Wire,pin?:string) {
    if(!circuit.connections)circuit.buildConnections()
    const nets=circuit.nets,found=new Set<typeof nets[number]>(),queue=nets.filter(n=>item instanceof Wire?n.wires.includes(item):n.drivers.some(d=>d.item===item&&(!pin||d.pin===pin))||!!pin&&n.receivers.some(r=>r.item===item&&r.pin===pin))
    for(let i=0;i<queue.length;i++){
        const n=queue[i];if(found.has(n))continue;found.add(n)
        for(const p of [...n.drivers,...n.receivers])if(p.item instanceof Cross){
            const mate={TL:'BR',BR:'TL',TR:'BL',BL:'TR'}[p.pin]
            for(const next of nets)if(!found.has(next)&&[...next.drivers,...next.receivers].some(v=>v.item===p.item&&v.pin===mate))queue.push(next)
        }
    }
    return new Set([...found].flatMap(n=>n.wires))
}
