import { Computer } from './index'
import { Gate } from '../../components/gates/core/Gate'
import { Coord, coord } from '../coord'

export function validateComputer(cpu: Computer) {
    const c=cpu.circuit;c.buildConnections()
    if(c.unconnected!.length)throw Error('open pins: '+c.unconnected!.length)
    const incoming=new Map<Gate,Map<string,{item:Gate,pin:string}>>()
    for(const wire of c.connections!){if(!incoming.has(wire.to))incoming.set(wire.to,new Map());incoming.get(wire.to)!.set(wire.toPin,{item:wire.from,pin:wire.fromPin})}
    const drivers=new Map<string,{item:Gate,pin:string}>()
    for(const n of cpu.nodes)for(const [pin,net]of Object.entries(n.signals))if(n.gate.pins[pin].type==='out')drivers.set(net,{item:n.gate,pin})
    function source(item:Gate,pin:string,seen=new Set<Gate>()):{item:Gate,pin:string}{
        const p=incoming.get(item)?.get(pin);if(!p)throw Error('missing driver')
        if(p.item.type!=='Cross')return p
        if(seen.has(p.item))throw Error('crossover cycle');seen.add(p.item)
        return source(p.item,{BR:'TL',BL:'TR'}[p.pin],seen)
    }
    for(const n of cpu.nodes)for(const [pin,net]of Object.entries(n.signals))if(n.gate.pins[pin].type==='in'){
        const actual=source(n.gate,pin),expected=drivers.get(net)!
        if(actual.item!==expected.item||actual.pin!==expected.pin)throw Error(`miswired ${n.id}.${pin}`)
    }
    for(const net of c.nets)if(net.drivers.length!==1||!net.receivers.length)throw Error('floating wire')
    const polygons=c.gates.map(({item,coords})=>({item,coords,p:([[0,0],[item.size.x,0],[item.size.x,item.size.y],[0,item.size.y]] as [number,number][]).map(p=>item.localToBoard(coord(p),coords))}))
    const overlap=(a:Coord[],b:Coord[])=>{
        for(const polygon of [a,b])for(let i=0;i<4;i++){
            const d=polygon[(i+1)%4].sub(polygon[i]),axis=coord([-d.y,d.x]),project=(p:Coord)=>p.x*axis.x+p.y*axis.y
            const av=a.map(project),bv=b.map(project)
            if(Math.min(Math.max(...av),Math.max(...bv))-Math.max(Math.min(...av),Math.min(...bv))<1e-7)return false
        }
        return true
    }
    const boxes=polygons.map(g=>({...g,minx:Math.min(...g.p.map(p=>p.x)),maxx:Math.max(...g.p.map(p=>p.x)),miny:Math.min(...g.p.map(p=>p.y)),maxy:Math.max(...g.p.map(p=>p.y))}))
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j]
        if(a.maxx>b.minx&&b.maxx>a.minx&&a.maxy>b.miny&&b.maxy>a.miny&&overlap(a.p,b.p))throw Error('overlapping gates')
    }
    const inside=(a:Coord,b:Coord,w:number,h:number)=>{
        let lo=0,hi=1;const d=b.sub(a),eps=1e-7
        for(const [start,delta,min,max]of [[a.x,d.x,eps,w-eps],[a.y,d.y,eps,h-eps]]){
            if(Math.abs(delta)<eps){if(start<min||start>max)return false}
            else {const u=(min-start)/delta,v=(max-start)/delta;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>=hi)return false}
        }
        return lo<hi
    }
    for(const {item:wire}of c.wires){
        if(wire.path.length<2)throw Error('degenerate wire')
        for(let i=1;i<wire.path.length;i++){
            const a=wire.path[i-1],b=wire.path[i]
            for(const g of boxes){
                if(Math.max(a.x,b.x)<g.minx||Math.min(a.x,b.x)>g.maxx||Math.max(a.y,b.y)<g.miny||Math.min(a.y,b.y)>g.maxy)continue
                const center=g.coords.add(g.item.size.div(2)),angle=-g.item.rotation*Math.PI/180
                const local=(p:Coord)=>{const d=p.sub(center);return coord([d.x*Math.cos(angle)-d.y*Math.sin(angle),d.x*Math.sin(angle)+d.y*Math.cos(angle)]).div(g.item.transformScale).add(g.item.size.div(2))}
                if(inside(local(a),local(b),g.item.size.x,g.item.size.y))throw Error('wire through '+(g.item.name||g.item.type))
            }
        }
    }
    return {logic:cpu.nodes.length-2,dffs:cpu.a.length+cpu.pc.length,crossovers:c.gates.filter(g=>g.item.type==='Cross').length,wires:c.wires.length,
        connections:c.connections!.length,pins:c.gates.reduce((n,g)=>n+Object.keys(g.item.pins).length,0),opens:0,shorts:0,overlaps:0,wireThroughGates:0}
}
