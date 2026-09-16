import { NativeComputer } from './build'
import { Wire } from '../../components/gates/core/Wire'
import { Coord } from '../coord'

// Check the finished native Wire geometry, including the Cross escape leads.
export function validateGeometry(computer:NativeComputer) {
    const {circuit,wireSignals}=computer
    const segments:{a:Coord,b:Coord,wire:Wire}[]=[]
    for(const {item:wire} of circuit.wires)for(let i=1;i<wire.path.length;i++)segments.push({a:wire.path[i-1],b:wire.path[i],wire})
    const inside=(a:Coord,b:Coord,x:number,y:number,w:number,h:number)=>{
        let lo=0,hi=1
        for(const [start,delta,min,max] of [[a.x,b.x-a.x,x,x+w],[a.y,b.y-a.y,y,y+h]]) {
            if(delta===0){if(start<=min||start>=max)return false;continue}
            const t1=(min-start)/delta,t2=(max-start)/delta
            lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2))
        }
        return hi-lo>1e-9
    }
    for(const s of segments)for(const g of circuit.gates)
        if(inside(s.a,s.b,g.coords.x,g.coords.y,g.item.size.x,g.item.size.y))throw Error('wire crosses gate body: '+(g.item.name||(g.item.constructor as any).type))
    const buckets=new Map<string,number[]>(),checked=new Set<string>()
    const cross=(a:Coord,b:Coord)=>a.x*b.y-a.y*b.x
    let collisions=0
    segments.forEach((s,i)=>{
        const {a,b}=s
        for(let x=Math.floor(Math.min(a.x,b.x)/8);x<=Math.floor(Math.max(a.x,b.x)/8);x++)
            for(let y=Math.floor(Math.min(a.y,b.y)/8);y<=Math.floor(Math.max(a.y,b.y)/8);y++) {
                const key=`${x},${y}`,list=buckets.get(key)||[]
                for(const j of list) {
                    const pair=`${j}:${i}`;if(checked.has(pair))continue;checked.add(pair)
                    const t=segments[j];if(s.wire===t.wire||wireSignals.get(s.wire)===wireSignals.get(t.wire))continue
                    const r=b.sub(a),v=t.b.sub(t.a),q=t.a.sub(a),d=cross(r,v)
                    if(Math.abs(d)>1e-9){const u=cross(q,r)/d,k=cross(q,v)/d;if(k>=0&&k<=1&&u>=0&&u<=1)collisions++}
                    else if(Math.abs(cross(q,r))<1e-9) {
                        const axis=Math.abs(r.x)>Math.abs(r.y)?'x':'y'
                        if(Math.max(Math.min(a[axis],b[axis]),Math.min(t.a[axis],t.b[axis]))<=Math.min(Math.max(a[axis],b[axis]),Math.max(t.a[axis],t.b[axis])))collisions++
                    }
                }
                list.push(i);buckets.set(key,list)
            }
    })
    if(collisions)throw Error(`unisolated wire intersections: ${collisions}`)
    return {segments:segments.length,wireBodyCollisions:0,unisolatedIntersections:0}
}
