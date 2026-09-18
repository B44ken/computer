export type Level = 0 | 1 | 'Z' | 'X'
export type Switch = {kind:'n'|'p',gate:string,from:string,to:string,x:number,y:number}
export type Segment = {net:string,points:number[][]}
export const switchModes=['n switch','p switch','not','nand','nor','or'] as const
export type SwitchMode=typeof switchModes[number]
export function switchCircuit(mode:SwitchMode){
    const switches:Switch[]=[],segments:Segment[]=[]
    const wire=(net:string,...points:number[][])=>segments.push({net,points})
    const transistor=(kind:'n'|'p',gate:string,from:string,to:string,x:number,y:number)=>switches.push({kind,gate,from,to,x,y})
    const inv=(x:number,input:string,out:string)=>{
        transistor('p',input,'vdd',out,x,145);transistor('n',input,out,'gnd',x,365)
        wire('vdd',[x,55],[x,121]);wire(out,[x,169],[x,341]);wire('gnd',[x,389],[x,470])
    }
    const nor=(x:number,out:string)=>{
        transistor('p','a','vdd','pmid',x,130);transistor('p','b','pmid',out,x,214)
        transistor('n','a',out,'gnd',x-90,365);transistor('n','b',out,'gnd',x+90,365)
        wire('vdd',[x,55],[x,106]);wire('pmid',[x,154],[x,190]);wire(out,[x,238],[x,280],[x-90,280],[x-90,341]);wire(out,[x,280],[x+90,280],[x+90,341])
        wire('gnd',[x-90,389],[x-90,450],[x+90,450],[x+90,389]);wire('gnd',[x,450],[x,470])
    }
    if(mode==='n switch'){
        transistor('n','a','out','gnd',280,330);wire('out',[280,210],[280,306]);wire('gnd',[280,354],[280,470])
    }else if(mode==='p switch'){
        transistor('p','a','vdd','out',280,145);wire('vdd',[280,55],[280,121]);wire('out',[280,169],[280,250])
    }else if(mode==='not')inv(280,'a','out')
    else if(mode==='nand'){
        transistor('p','a','vdd','out',180,145);transistor('p','b','vdd','out',380,145)
        transistor('n','a','out','nmid',280,330);transistor('n','b','nmid','gnd',280,414)
        wire('vdd',[280,55],[280,80],[180,80],[180,121]);wire('vdd',[280,80],[380,80],[380,121])
        wire('out',[180,169],[180,250],[380,250],[380,169]);wire('out',[280,250],[280,306])
        wire('nmid',[280,354],[280,390]);wire('gnd',[280,438],[280,470])
    }else if(mode==='nor')nor(280,'out')
    else {nor(240,'nor');inv(650,'nor','out');wire('nor',[240,280],[460,280]);wire('out',[650,250],[740,250])}
    if(mode!=='or')wire('out',[280,250],[480,250])
    return {switches,segments,width:mode==='or'?820:580,height:510}
}
export function resolveSwitches(switches:Switch[],a:0|1,b:0|1){
    const nets=[...new Set(['vdd','gnd','a','b',...switches.flatMap(t=>[t.from,t.to,t.gate])])]
    let values:Record<string,Level>=Object.fromEntries(nets.map(n=>[n,n==='vdd'?1:n==='gnd'?0:n==='a'?a:n==='b'?b:'Z']))
    for(let step=0;step<=nets.length;step++){
        const parent=Object.fromEntries(nets.map(n=>[n,n]))
        const root=(n:string):string=>parent[n]===n?n:parent[n]=root(parent[n])
        for(const t of switches)if(values[t.gate]===(t.kind==='n'?1:0))parent[root(t.from)]=root(t.to)
        const next:Record<string,Level>={}
        for(const n of nets){const v=root(n)===root('vdd'),g=root(n)===root('gnd');next[n]=n==='a'?a:n==='b'?b:v&&g?'X':v?1:g?0:'Z'}
        if(nets.every(n=>values[n]===next[n]))return next
        values=next
    }
    throw Error('switch network did not settle')
}
