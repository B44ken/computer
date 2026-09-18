import { Circuit } from '../circuit'
import { coord } from '../coord'
import { Gate, Wire, Button, Lightbulb, ANDGate, NANDGate, ORGate, NORGate, XORGate, XNORGate, NOTGate, MUXGate, DFFGate, Cross, Memory } from '../../components/gates'
import { route } from '../computer/routing'
import { buildComputer } from '../computer'
import { serializeCircuit, deserializeCircuit } from '../serialization'
import { assemble, programs } from '../computer/programs'
import { validateComputer } from '../computer/validate'

const gates = { AND:ANDGate, NAND:NANDGate, OR:ORGate, NOR:NORGate, XOR:XORGate, XNOR:XNORGate, NOT:NOTGate, MUX:MUXGate, DFF:DFFGate }
type Node = {id:string, gate:Gate, signals:Record<string,string>, x:number, y:number, w:number, h:number}
export type Lab = { id:string, title:string, circuit:Circuit, inputs:string[], outputs:string[], frame:{x:number,y:number,width:number,height:number}, nodes:Node[], task:string, hint:string, clock?:string }
export const labIds = ['nand-not','nand-and','nand-or','byte','mux','cross','half','full','adder4','sub4','latch','dff','register','ram','counter','decode','accumulator'] as const
export type LabId = typeof labIds[number] | 'computer'
const pointKey = (p:number[]) => p.map(n=>Math.round(n*1e8)/1e8).join(',')

// Construction only. The output is the existing editor's Gate/Wire/Circuit;
// all execution and connectivity are handled by Circuit, not this description.
function wireLayout(nodes:Node[], width:number, height:number) {
    const result = route({nodes,width,height,groups:[],variant:'lesson'}), circuit = new Circuit()
    const crossPorts = new Map<string, Map<string, ReturnType<typeof coord>>>()
    for(const n of nodes) circuit.add(n.gate,[n.x,n.y])
    for(const cross of result.crosses) {
        const gate = new Cross(); gate.rotation=cross.rotation; gate.transformScale=.45
        const origin=coord([cross.x-.5,cross.y-.5]); circuit.add(gate,origin)
        crossPorts.set(pointKey([cross.x,cross.y]),new Map(Object.keys(gate.pins).map(pin=>{
            const p=gate.pinPosition(pin,origin),dx=p.x-cross.x,dy=p.y-cross.y
            return [Math.abs(dx)>Math.abs(dy)?dx<0?'W':'E':dy<0?'N':'S',p]
        })))
    }
    const graph = new Map<string,{p:number[],edges:any[]}>(), seen = new Set()
    const terminals=new Set(result.pins.map(p=>pointKey([p.x,p.y])))
    for(const c of result.crosses)terminals.add(pointKey([c.x,c.y]))
    for(const e of result.edges)for(const p of [e.a,e.b]){
        const k=pointKey(p);if(!graph.has(k))graph.set(k,{p,edges:[]});graph.get(k)!.edges.push(e)
    }
    const boundary=(k:string)=>terminals.has(k)||graph.get(k)!.edges.length!==2
    const adjust=(p:number[],toward:number[])=>crossPorts.get(pointKey(p))?.get(toward[0]!==p[0]?toward[0]<p[0]?'W':'E':toward[1]<p[1]?'N':'S')||coord(p as [number,number])
    for(const [k,node] of graph)if(boundary(k))for(const first of node.edges){
        if(seen.has(first))continue
        let e=first,from=node.p;const points=[from]
        while(true){seen.add(e);const next=pointKey(e.a)===pointKey(from)?e.b:e.a;points.push(next);const k=pointKey(next);if(boundary(k))break;const edges=graph.get(k)!.edges;e=edges[0]===e?edges[1]:edges[0];from=next}
        const pts=points.map(p=>coord(p as [number,number]));pts[0]=adjust(points[0],points[1]);pts[pts.length-1]=adjust(points.at(-1)!,points.at(-2)!)
        circuit.add(new Wire(pts))
    }
    if(seen.size!==result.edges.length)throw Error('unconnected routing loop')
    return circuit
}

export function makeLab(id:LabId):Lab {
    if(id==='computer'){
        const cpu=buildComputer('manual')
        return {id,title:'the complete computer',circuit:cpu.circuit,nodes:cpu.nodes,inputs:['clock'],outputs:[],clock:'clock',frame:{x:0,y:0,width:cpu.layout.width,height:cpu.layout.height},
            task:'connect the accumulator to its load/hold path, then pass all five programs.',hint:'follow a0: the wire ending on its D pin carries the next least-significant accumulator bit.'}
    }
    const nodes:Node[]=[],inputs:string[]=[],outputs:string[]=[]
    const add=(id:string,gate:Gate,signals:Record<string,string>,x:number,y:number)=>{nodes.push({id,gate,signals,x,y,w:gate.size.x,h:gate.size.y});return id}
    const input=(name:string,y:number,value=false)=>{const g=new Button(name);g.set('Y',value);add(name,g,{Y:name},4,y);inputs.push(name);return name}
    const output=(name:string,net:string,x:number,y:number)=>{add(name,new Lightbulb(name),{A:net},x,y);outputs.push(name)}
    let count=0
    const g=(kind:keyof typeof gates,ins:string[],x:number,y:number,name=`g${++count}`)=>{
        const gate:Gate=new gates[kind](name),pins=kind==='DFF'?['D','CLK']:kind==='MUX'?['A','B','S']:['A','B']
        const signals=Object.fromEntries(ins.map((n,i)=>[pins[i],n]));signals[kind==='DFF'?'Q':'Y']=name
        return add(name,gate,signals,x,y)
    }
    const bits=(prefix:string,n:number,start=4)=>Array.from({length:n},(_,i)=>input(prefix+i,start+i*7))
    const full=(a:string,b:string,c:string,x:number,y:number)=>{
        const p=g('XOR',[a,b],x,y),sum=g('XOR',[p,c],x+9,y),gen=g('AND',[a,b],x,y+5),prop=g('AND',[p,c],x+9,y+5)
        return [sum,g('OR',[gen,prop],x+18,y+5)]
    }
    let title='',task='',hint='',clock:string|undefined
    const A=()=>input('a',4),B=()=>input('b',14)
    switch(id){
        case 'nand-not':{title='not from nand';const a=A();output('out',g('NAND',[a,a],16,5),27,6);break}
        case 'nand-and':{title='and from nand';const a=A(),b=B(),n=g('NAND',[a,b],16,5);output('out',g('NAND',[n,n],26,5),37,6);break}
        case 'nand-or':{title='or from nand';const a=A(),b=B(),na=g('NAND',[a,a],16,4),nb=g('NAND',[b,b],16,14);output('out',g('NAND',[na,nb],28,8),39,9);break}
        case 'byte':{title='eight wires, one byte';const a=bits('b',8);a.forEach((s,i)=>output('q'+i,s,17,4+i*7));break}
        case 'mux':{title='a selector from four gates';const a=A(),b=B(),s=input('s',24),ns=g('NOT',[s],16,24),lo=g('AND',[a,ns],26,4),hi=g('AND',[b,s],26,14);output('out',g('OR',[lo,hi],37,9),48,10);break}
        case 'cross':{
            title='crossing without connecting';input('a',3);input('b',13)
            const cross=new Cross('bridge');add('bridge',cross,{TL:'a',TR:'b',BL:'from-b',BR:'from-a'},17,8)
            output('qa','from-a',29,4);output('qb','from-b',29,14)
            // Hand-routed leads reach the ORIGINAL corner pins.
            const c=new Circuit();nodes.forEach(n=>c.add(n.gate,[n.x,n.y]))
            for(const p of [[[6,4],[14,4],[14,8],[17,8]],[[6,14],[10,14],[10,2],[22,2],[22,8],[18,8]],[[18,9],[24,9],[24,5],[29,5]],[[17,9],[17,15],[29,15]]])c.add(new Wire(p as [number,number][]))
            c.update();return {id,title,circuit:c,inputs,outputs,nodes,frame:{x:0,y:0,width:36,height:20},task:'connect both channels so qa follows a and qb follows b independently.',hint:'TL → BR is one channel; TR → BL is the other. a wire crossing is not a junction.'}
        }
        case 'half':{title='half adder';const a=A(),b=B();output('sum',g('XOR',[a,b],17,4),30,5);output('carry',g('AND',[a,b],17,14),30,15);break}
        case 'full':{title='full adder';const a=A(),b=B(),c=input('cin',24),[s,co]=full(a,b,c,18,7);output('sum',s,50,5);output('cout',co,50,17);break}
        case 'adder4':case 'sub4':{
            const sub=id==='sub4';title=sub?'four-bit subtraction':'four-bit ripple addition'
            const a=bits('a',4,4),b=bits('b',4,37);let carry=input('cin',68,sub)
            for(let i=0;i<4;i++){
                const y=6+i*16,operand=sub?g('NOT',[b[i]],16,y+6):b[i]
                const [s,c]=full(a[i],operand,carry,27,y);carry=c;output('q'+i,s,62,y)
            }
            output('cout',carry,62,71);hint=sub?'invert every b bit and set cin = 1: a + ~b + 1. cout = 1 means no unsigned borrow.':'carry out from bit i is carry in to bit i+1. bit zero gets the cin button.';break
        }
        case 'latch':{
            title='remember with feedback';const s=input('set',4),r=input('reset',17,true)
            g('NOR',[r,'qbar'],22,5,'q');g('NOR',[s,'q'],22,17,'qbar');output('out','q',36,6);output('not-q','qbar',36,18)
            // Pick one consistent initial fixed point for this ideal lab.
            nodes.find(n=>n.id==='q')!.gate.set('Y',false);nodes.find(n=>n.id==='qbar')!.gate.set('Y',true)
            hint='set high, then low: q should stay high. reset high, then low: q should stay low. never assert both.';break
        }
        case 'dff':{
            title='a single edge-triggered bit';const d=input('d',4);clock=input('clk',17);output('q',g('DFF',[d,clock],19,7,'state'),32,8);hint='a rising clock edge captures d. changing d while the clock stays high does not change q.';break
        }
        case 'register':{
            title='four independent bits, one clock';const data=bits('d',4);const en=input('load',35);clock=input('clk',43)
            for(let i=0;i<4;i++){const next=g('MUX',['r'+i,data[i],en],20,5+i*9);g('DFF',[next,clock],31,5+i*9,'r'+i);output('q'+i,'r'+i,44,6+i*9)}
            hint='the feedback mux selects old q when load=0 and the new data when load=1.';break
        }
        case 'ram':{
            title='two words of two bits';const data=bits('d',2);const address=input('addr',21),we=input('we',32);clock=input('clk',42)
            const na=g('NOT',[address],16,21),w0=g('AND',[na,we],25,21),w1=g('AND',[address,we],25,32)
            for(let w=0;w<2;w++)for(let i=0;i<2;i++){
                const y=5+(w*2+i)*11,name=`r${w}${i}`,next=g('MUX',[name,data[i],w?w1:w0],38,y);g('DFF',[next,clock],49,y,name)
            }
            for(let i=0;i<2;i++)output('q'+i,g('MUX',['r0'+i,'r1'+i,address],62,9+i*20),74,10+i*20)
            hint='we AND NOT addr loads word 0. we AND addr loads word 1. the read mux selects a word without a clock edge.';break
        }
        case 'counter':{
            title='count, or jump';const target=bits('t',4);const jump=input('jump',35);clock=input('clk',46)
            let carry='pc0'
            for(let i=0;i<4;i++){
                const y=5+i*12,inc=g(i?'XOR':'NOT',i?['pc'+i,carry]:['pc0'],19,y)
                if(i&&i<3)carry=g('AND',['pc'+i,carry],28,y+5)
                const next=g('MUX',[inc,target[i],jump],40,y);g('DFF',[next,clock],51,y,'pc'+i);output('q'+i,'pc'+i,64,y+1)
            }
            hint='every clock increments, unless jump selects the target. 1111 increments to 0000.';break
        }
        case 'decode':{
            title='two bits become four control wires';const lo=input('lo',4),hi=input('hi',18),nl=g('NOT',[lo],16,4),nh=g('NOT',[hi],16,18)
            for(const [i,ins] of [[0,[nl,nh]],[1,[lo,nh]],[2,[nl,hi]],[3,[lo,hi]]] as [number,string[]][])output(['lda','sta','sub','jz'][i],g('AND',ins,29,4+i*8),42,5+i*8)
            hint='an output is high for exactly one bit pattern. each AND uses either a bit or its complement.';break
        }
        case 'accumulator':{
            title='load, subtract, or hold one accumulator bit';const m=input('m',4),borrow=input('bin',13),sub=input('sub',23),load=input('write',33);clock=input('clk',44)
            const p=g('XOR',['a',m],18,5),d=g('XOR',[p,borrow],27,5),next=g('MUX',[m,d,sub],38,5),hold=g('MUX',['a',next,load],48,5)
            g('DFF',[hold,clock],59,5,'a');output('q','a',72,6);output('bout',g('MUX',[borrow,m,p],28,18),41,19)
            hint='xor computes difference bits; a mux chooses load/subtract; another chooses hold/write. this is one bit, not a hidden ALU.';break
        }
    }
    task ||= 'repair the missing output wire, then check the real circuit. or start from unwired parts and build it yourself.'
    hint ||= 'inspect a pin to highlight its net. wires ending on another wire form junctions. connect the loose output path to the lamp’s input.'
    const width=Math.max(...nodes.map(n=>n.x+n.w))+9,height=Math.max(...nodes.map(n=>n.y+n.h))+9
    const circuit=wireLayout(nodes,width,height);circuit.update()
    if(id==='latch'){setInput(circuit,'reset',false);circuit.update()}
    return {id,title,circuit,inputs,outputs,nodes,frame:{x:0,y:0,width,height},task,hint,clock}
}

export function setInput(c:Circuit,name:string,value:boolean){const g=c.gates.find(g=>g.item.name===name&&g.item instanceof Button)?.item;if(!g)throw Error('missing input '+name);g.set('Y',value)}
export function readOutput(c:Circuit,name:string){const g=c.gates.find(g=>g.item.name===name)?.item;if(!g)throw Error('missing output '+name);return !!g.get(g instanceof DFFGate?'Q':'A')}
export const readWord=(c:Circuit,prefix:string,n:number)=>Array.from({length:n},(_,i)=>readOutput(c,prefix+i)?1<<i:0).reduce((a,b)=>a+b,0)
export function pulse(c:Circuit,name='clk'){setInput(c,name,false);c.update();setInput(c,name,true);c.update();setInput(c,name,false);c.update()}
export function brokenLab(lab:Lab){
    const c=deserializeCircuit(serializeCircuit(lab.circuit))
    const target=c.gates.find(g=>g.item.name===(lab.id==='computer'?'a0':lab.outputs[0]))!
    const pin=target.item.pinPosition(lab.id==='computer'?'D':'A',target.coords)
    const index=c.wires.findIndex(w=>w.item.has(pin));if(index<0)throw Error('no challenge wire')
    c.remove(index,c.wires[index].item);return c
}
export function checkLab(id:LabId,original:Circuit){
    try {
        const c=deserializeCircuit(serializeCircuit(original)); c.buildConnections()
        if(c.unconnected!.length)throw Error(`${c.unconnected!.length} input pin(s) have no driver. first: ${c.unconnected![0].item.name}.${c.unconnected![0].pin}`)
        const permitted=id.startsWith('nand-')?['NAND','Cross','Button','Lightbulb']:['AND','NAND','OR','NOR','XOR','XNOR','MUX','NOT','DFF','Cross','Button','Lightbulb',...(id==='computer'?['Memory']:[])]
        if(c.gates.some(g=>!permitted.includes(g.item.type)||(id==='mux'&&g.item.type==='MUX')))throw Error('use the allowed primitive gates for this lab')
        validateComputer({circuit:c,nodes:[],a:[],pc:[]} as any) // geometry audit, without requiring the reference topology
        let cases=0
        const run=(ins:Record<string,number>,expected:Record<string,number>,tick=false)=>{
            Object.entries(ins).forEach(([n,v])=>setInput(c,n,!!v));if(tick)pulse(c);else c.update()
            for(const [n,v] of Object.entries(expected))if(readOutput(c,n)!==!!v)throw Error(`${JSON.stringify(ins)}: ${n} should be ${v}, got ${Number(readOutput(c,n))}`)
            cases++
        }
        const wb=(prefix:string,n:number,width=4)=>Object.fromEntries(Array.from({length:width},(_,i)=>[prefix+i,(n>>i)&1]))
        if(id==='computer'){
            const memory=c.gates.find(g=>g.item instanceof Memory)?.item as Memory
            const regs=c.gates.filter(g=>g.item instanceof DFFGate);if(regs.length!==14||!memory)throw Error('the cpu needs 14 dffs and its memory interface')
            for(const p of programs){setInput(c,'clock',false);regs.forEach(g=>(g.item as DFFGate).powerOn());memory.load(assemble(p.source).image);c.update();for(let i=0;i<p.cycles;i++)pulse(c,'clock');for(const [a,v]of Object.entries(p.expected))if(memory.bytes[+a]!==v)throw Error(`${p.name}: memory[${a}] should be ${v}`);cases++}
        } else if(id==='latch'){
            for(let i=0;i<4;i++){run({set:0,reset:1},{out:0,'not-q':1});run({set:0,reset:0},{out:0});run({set:1,reset:0},{out:1,'not-q':0});run({set:0,reset:0},{out:1})}
        } else if(id==='dff'){
            run({d:0,clk:0},{},true);run({d:1,clk:0},{q:0});run({clk:1},{q:1});run({d:0},{q:1});run({clk:0},{q:1});run({clk:1},{q:0})
        } else if(id==='register'){
            for(let n=0;n<16;n++){run({...wb('d',n),load:1},wb('q',n),true);run({...wb('d',n^15),load:0},wb('q',n),true)}
        } else if(id==='ram'){
            for(let a=0;a<4;a++)for(let b=0;b<4;b++){
                run({...wb('d',a,2),addr:0,we:1},wb('q',a,2),true);run({...wb('d',b,2),addr:1,we:1},wb('q',b,2),true)
                run({addr:0,we:0},wb('q',a,2));run({...wb('d',a^3,2)},wb('q',a,2),true);run({addr:1},wb('q',b,2))
            }
        } else if(id==='counter'){
            for(let n=0;n<16;n++){run({...wb('t',n),jump:1},wb('q',n),true);run({jump:0},wb('q',(n+1)&15),true)}
        } else if(id==='accumulator'){
            for(let a=0;a<2;a++)for(let m=0;m<2;m++)for(let bin=0;bin<2;bin++){
                run({m:a,bin:0,write:1,sub:0},{q:a},true)
                run({m,bin,sub:1,write:0},{q:a,bout:a-m-bin<0?1:0});run({write:1},{q:(a-m-bin)&1},true)
            }
        } else {
            const names=makeLab(id).inputs
            const total=1<<names.length
            for(let n=0;n<total;n++){
                const v=Object.fromEntries(names.map((name,i)=>[name,(n>>i)&1])),a=v.a||0,b=v.b||0,ci=v.cin||0
                if(id==='sub4'&&!ci)continue
                let out:Record<string,number>
                switch(id){
                    case 'nand-not':out={out:1-a};break
                    case 'nand-and':out={out:a&b};break
                    case 'nand-or':out={out:a|b};break
                    case 'byte':out=Object.fromEntries(Array.from({length:8},(_,i)=>['q'+i,v['b'+i]]));break
                    case 'mux':out={out:v.s?b:a};break
                    case 'cross':out={qa:a,qb:b};break
                    case 'half':out={sum:a^b,carry:a&b};break
                    case 'full':out={sum:(a+b+ci)&1,cout:(a+b+ci)>>1};break
                    case 'adder4':case 'sub4':{
                        const a=names.filter(s=>s[0]==='a').reduce((n,s,i)=>n+(v[s]<<i),0),b=names.filter(s=>s[0]==='b').reduce((n,s,i)=>n+(v[s]<<i),0)
                        const r=id==='sub4'?a+((~b)&15)+1:a+b+ci;out={...wb('q',r&15),cout:r>>4};break
                    }
                    case 'decode':out=Object.fromEntries(['lda','sta','sub','jz'].map((s,i)=>[s,+(i===((v.hi<<1)|v.lo))]));break
                    default:throw Error('no checks for '+id)
                }
                run(v,out)
            }
        }
        return {ok:true,message:`passed ${cases} checks on the actual wired circuit.`,cases}
    } catch(e){return {ok:false,message:(e as Error).message,cases:0}}
}

export function auditLab(lab:Lab){
    // Reuse the merged board's geometric auditor (counts are irrelevant here).
    const aliases = new Map<string,string>()
    for(const n of lab.nodes)if(n.gate.type==='Cross'){aliases.set(n.signals.BR,n.signals.TL);aliases.set(n.signals.BL,n.signals.TR)}
    const nodes=lab.nodes.filter(n=>n.gate.type!=='Cross').map(n=>({...n,signals:Object.fromEntries(Object.entries(n.signals).map(([p,s])=>[p,aliases.get(s)||s]))}))
    return validateComputer({circuit:lab.circuit,nodes,a:[],pc:[]} as any)
}
