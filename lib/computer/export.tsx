import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NativeComputer } from './build'
import { SVGGate, SVGWire } from '../../components/CircuitBoard'
import { coord } from '../coord'
import { Gate } from '../../components/gates/core/Gate'

export function nativeSVG(computer:NativeComputer): string {
    const {circuit,bounds:b}=computer,origin=coord([0,0])
    const image: React.ReactElement = <svg xmlns="http://www.w3.org/2000/svg" width={Math.ceil((b.width+10)*10)} height={Math.ceil((b.height+10)*10)} viewBox={`${b.x-5} ${b.y-5} ${b.width+10} ${b.height+10}`}>
        <rect x={b.x-5} y={b.y-5} width={b.width+10} height={b.height+10} fill="#fafbf9"/>
        {computer.groups.map((g,i)=><g key={i}><rect x={g.x} y={g.y} width={g.w} height={g.h} fill="#dde6df" opacity={.35}/><text x={g.x} y={g.y-1} fontSize={.9} fill="#476052">{g.title}</text></g>)}
        {circuit.wires.map((w,i)=><SVGWire key={i} wire={w.item} scale={1} origin={origin}/>)}
        {circuit.gates.map((g,i)=><SVGGate key={i} gate={g.item} coords={g.coords} scale={1} origin={origin} showName={computer.variant==='manual'}/>)}
    </svg>
    return renderToStaticMarkup(image)
}
export function nativeJSON(computer:NativeComputer) {
    return {schema:'native-circuit/v1',gates:computer.circuit.gates.map(g=>({type:(g.item.constructor as any).type,name:g.item.name,coords:[g.coords.x,g.coords.y],size:[g.item.size.x,g.item.size.y],pins:Object.fromEntries(Object.entries(g.item.pins).map(([n,p])=>[n,{...p,coord:[p.coord.x,p.coord.y]}]))})),wires:computer.circuit.wires.map(w=>w.item.path.map(p=>[p.x,p.y])),memory:[...computer.memory.bytes],metrics:computer.metrics}
}
export const primitiveVerilog=`module AND(input a,b,output q); assign q=a&b; endmodule
module NAND(input a,b,output q); assign q=~(a&b); endmodule
module OR(input a,b,output q); assign q=a|b; endmodule
module NOR(input a,b,output q); assign q=~(a|b); endmodule
module XOR(input a,b,output q); assign q=a^b; endmodule
module XNOR(input a,b,output q); assign q=~(a^b); endmodule
module NOT(input a,output q); assign q=~a; endmodule
module MUX(input a,b,s,output q); assign q=s?b:a; endmodule
module DFF(input d,clk,output reg q=0); always @(posedge clk) q<=d; endmodule\n`

export function nativeVerilog(computer:NativeComputer) {
    // Export the native simulator's extracted nets, NOT the construction recipe.
    const c=computer.circuit;c.buildConnections()
    const nets=new Map<Gate,Map<string,string>>()
    c.nets.forEach((net,i)=>{
        if(net.drivers.length!==1)throw Error('cannot export an undriven net')
        for(const p of [...net.drivers,...net.receivers]){if(!nets.has(p.item))nets.set(p.item,new Map());nets.get(p.item)!.set(p.pin,`n${i}`)}
    })
    const pin=(g:Gate,name:string)=>{const n=nets.get(g)?.get(name);if(!n)throw Error('unwired '+g.name+'.'+name);return n}
    const vector=(g:Gate,prefix:string,count:number)=>'{'+Array.from({length:count},(_,i)=>pin(g,prefix+(count-1-i))).join(',')+'}'
    const out=[`module computer_${computer.variant}(input wire clk,output wire [7:0] a,output wire [5:0] pc,output wire we);`]
    out.push(`wire ${c.nets.map((_,i)=>`n${i}`).join(',')};`)
    c.gates.forEach(({item:g},i)=>{
        const type=(g.constructor as any).type
        if(type==='Button'){if(g!==computer.clock)throw Error('unexpected stimulus');out.push(`assign ${pin(g,'Y')}=clk;`)}
        else if(type==='Memory')out.push(`stupid_memory memory(${pin(g,'CLK')},${vector(g,'PC',6)},${vector(g,'AD',6)},${pin(g,'WE')},${vector(g,'W',8)},${vector(g,'I',8)},${vector(g,'R',8)});`)
        else if(type==='Cross')out.push(`assign ${pin(g,'BR')}=${pin(g,'TL')}; assign ${pin(g,'BL')}=${pin(g,'TR')};`)
        else {
            const names=type==='NOT'?['A','Y']:type==='MUX'?['A','B','S','Y']:type==='DFF'?['D','CLK','Q']:['A','B','Y']
            out.push(`${type} g${i}(${names.map(p=>pin(g,p)).join(',')});`)
        }
    })
    for(const [prefix,width] of [['a',8],['pc',6]] as const)for(let i=0;i<width;i++)out.push(`assign ${prefix}[${i}]=${pin(computer.byName.get(`${prefix}[${i}]`)!,'Q')};`)
    out.push(`assign we=${pin(computer.memory,'WE')};`,'endmodule')
    return out.join('\n')
}
