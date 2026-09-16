import * as gates from '../components/gates'
import { Circuit } from './circuit'
import { coord } from './coord'

const types = Object.fromEntries(Object.values(gates).filter((v: any) => v?.type && v !== gates.Gate).map((v: any) => [v.type,v]))
export function serializeCircuit(circuit: Circuit) {
    return {format:'computer/Circuit',version:1,annotations:circuit.annotations,
        gates:circuit.gates.map(({item,coords})=>({type:item.type,name:item.name,coords:[coords.x,coords.y],rotation:item.rotation,transformScale:item.transformScale,
            pins:Object.fromEntries(Object.entries(item.pins).map(([name,p])=>[name,!!p.voltage])),
            ...(item instanceof gates.Memory?{bytes:[...item.bytes]}:{})})),
        wires:circuit.wires.map(({item})=>item.path.map(p=>[p.x,p.y]))}
}
export function deserializeCircuit(data: ReturnType<typeof serializeCircuit>) {
    if(data.format!=='computer/Circuit'||data.version!==1)throw Error('not a Circuit export')
    const c=new Circuit()
    for(const saved of data.gates){
        const Constructor=types[saved.type] as any
        if(!Constructor)throw Error('unknown gate '+saved.type)
        const gate=new Constructor(saved.name) as gates.Gate
        gate.rotation=saved.rotation||0;gate.transformScale=saved.transformScale??1
        if(gate instanceof gates.Memory)gate.load(Uint8Array.from(saved.bytes!))
        for(const [pin,value]of Object.entries(saved.pins)){if(!gate.pins[pin])throw Error('unknown pin');gate.set(pin,!!value)}
        // Remember the imported clock level without committing a new edge.
        gate.sample()
        c.add(gate,coord(saved.coords as [number,number]))
    }
    for(const path of data.wires)c.add(new gates.Wire(path as [number,number][]))
    c.annotations=data.annotations||[];c.buildConnections();c.update();return c
}
