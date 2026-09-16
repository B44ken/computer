import {buildCPU,Machine,assemble,disassemble,programs} from './core.mjs';
import {place,route,validateLayout} from './layout.mjs';
import {diagram} from './view.mjs';
const $=id=>document.getElementById(id),hex=n=>n.toString(16).padStart(2,'0');
let variant='manual',cpu=buildCPU(variant),machine=new Machine(cpu),layout,selected=null,lastWrite=null,timer=null,box=[0,0,216,244],drag=null;
const layouts=new Map();
const status=s=>{$('status').textContent=s;$('status').classList.remove('error');};
function pause(){clearInterval(timer);timer=null;$('run').textContent='run';}
function view(){ $('board').setAttribute('viewBox',box.join(' ')); }
function fit(){box=[0,0,layout.width,layout.height];view();}
function render() {
  if(!layout)return;
  $('board').innerHTML=diagram(layout,machine.values,selected);view();
  $('reg-a').textContent=hex(machine.a);$('reg-pc').textContent=hex(machine.pc);$('cycles').textContent=machine.cycles;
  $('instruction').innerHTML=`<code>${machine.inst.toString(2).padStart(8,'0').slice(0,2)} | ${machine.inst.toString(2).padStart(8,'0').slice(2)}</code><br><strong>${disassemble(machine.inst)}</strong> · operand = ${hex(machine.memory[machine.inst&63])}`;
  $('memory').innerHTML=Array.from(machine.memory,(b,i)=>`<button data-address="${i}" class="${i===machine.pc?'pc ':''}${lastWrite===i?'write':''}" title="address ${hex(i)} · ${disassemble(b)}"><small>${hex(i)}</small>${hex(b)}</button>`).join('');
  const m=layout.metrics;$('metrics').textContent=`${m.gates} gates · ${m.crossovers} crosses · ${m.width} × ${m.height}`;
  const c=cpu.cells.find(c=>c.output===selected);
  $('selection').textContent=selected?`${selected} = ${machine.values[selected]??0}${c?'\n'+c.type+'('+c.inputs.map(n=>`${n}=${machine.values[n]}`).join(', ')+')':''}`:'click a gate or wire; scroll to zoom, drag to pan.';
}
function load() {
  pause();try{const p=assemble($('source').value);machine.powerOn(p.image);lastWrite=null;
    $('assembly').textContent=`${p.listing.length} bytes assembled. no hardware halt; examples park in jz loops.`;
    $('assembly').classList.remove('error');render();status('program loaded; DFFs initialized to zero, as in the verilog.');
  }catch(e){$('assembly').textContent=e.message;$('assembly').classList.add('error');}
}
async function changeVariant(next) {
  pause();status('placing, routing, and extracting connectivity…');await new Promise(r=>setTimeout(r,20));
  try {
    const nextCPU=buildCPU(next);
    if(!layouts.has(next))layouts.set(next,route(place(nextCPU)));
    variant=next;cpu=nextCPU;layout=layouts.get(next);machine=new Machine(cpu);
    for(const v of ['manual','auto'])$(v).classList.toggle('active',v===variant);
    $('explanation').textContent=variant==='manual'?'hand-built ripple datapath and fixed bit-slice placement. shared nets are obstacle-routed; group labels do not hide any gates. carry uses a scalar mux.':'annealed placement and orthogonal multi-terminal routing. every isolated crossing is explicit. full-adder carry is AND/OR gates, not an adder component.';
    load();fit();render();const v=validateLayout(layout);status(`${v.pins} pins checked · ${v.nets} connected nets · zero opens, shorts, or overlapping gates.`);
  }catch(e){status(e.message);$('status').classList.add('error');throw e;}
}
function step(n=1) {
  let last;for(let i=0;i<n;i++){last=machine.edge();if(last.write)lastWrite=last.write.address;}
  render();status(`edge ${last.cycle}: pc ${hex(last.before.pc)} → ${hex(last.after.pc)}, a ${hex(last.before.a)} → ${hex(last.after.a)}${last.write?`; memory[${hex(last.write.address)}] ← ${hex(last.write.value)}`:''}`);
  return last;
}
$('program').innerHTML=programs.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('');
$('program').onchange=()=>{$('source').value=programs[+$('program').value].source;load();};
$('source').value=programs[0].source;
$('load').onclick=load;$('step').onclick=()=>{pause();step();};$('step10').onclick=()=>{pause();step(10);};
$('run').onclick=()=>{
  if(timer){pause();return;}$('run').textContent='pause';
  timer=setInterval(()=>{const e=step();if(e.before.pc===e.after.pc&&e.before.a===0&&e.before.inst>>6===3){pause();status('park loop reached; viewer paused. the cpu has no halt instruction.');}},150);
};
for(const v of ['manual','auto'])$(v).onclick=()=>changeVariant(v);
$('fit').onclick=fit;
function zoom(factor,cx=box[0]+box[2]/2,cy=box[1]+box[3]/2){box=[cx+(box[0]-cx)*factor,cy+(box[1]-cy)*factor,box[2]*factor,box[3]*factor];view();}
$('zoom-in').onclick=()=>zoom(.7);$('zoom-out').onclick=()=>zoom(1/.7);
function focus(group){const ns=layout.nodes.filter(c=>c.group===group||group==='alu'&&c.group==='acc');const x=Math.min(...ns.map(c=>c.x))-5,y=Math.min(...ns.map(c=>c.y))-6;box=[x,y,Math.max(...ns.map(c=>c.x+c.w))-x+5,Math.max(...ns.map(c=>c.y+c.h))-y+5];view();}
$('focus-alu').onclick=()=>focus('alu');$('focus-pc').onclick=()=>focus('pc');
$('clear').onclick=()=>{selected=null;render();};
function point(e){const p=$('board').createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform($('board').getScreenCTM().inverse());}
$('board').addEventListener('wheel',e=>{e.preventDefault();const p=point(e);zoom(e.deltaY>0?1.13:1/1.13,p.x,p.y);},{passive:false});
$('board').onpointerdown=e=>{const p=point(e);drag={x:p.x,y:p.y,sx:e.clientX,sy:e.clientY,box:[...box],target:e.target};$('board').setPointerCapture(e.pointerId);};
$('board').onpointermove=e=>{if(!drag)return;const p=point(e);box[0]+=drag.x-p.x;box[1]+=drag.y-p.y;view();};
$('board').onpointerup=e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<4){const el=drag.target.closest('[data-net],[data-cell]');if(el){selected=el.dataset.net||cpu.cells.find(c=>c.id===el.dataset.cell)?.output||null;render();}}drag=null;};
$('memory').ondblclick=e=>{const el=e.target.closest('[data-address]');if(!el)return;pause();const addr=+el.dataset.address,text=prompt(`memory[${hex(addr)}] (hex byte)`,hex(machine.memory[addr]));if(text===null)return;if(!/^[\da-f]{1,2}$/i.test(text.trim())){status('enter 00–ff.');return;}machine.memory[addr]=parseInt(text,16);machine.settle();render();};
$('export').onclick=()=>{const data={schema:'gate-computer/v1',netlist:cpu,layout,memory:[...machine.memory],a:machine.a,pc:machine.pc,cycles:machine.cycles};const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`computer-${variant}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['TEXTAREA','INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();pause();step();}});
// A small test surface; the browser and tests operate on the same primitive simulator.
window.gateComputer={get machine(){return machine},get layout(){return layout},changeVariant,step,load,validate:()=>validateLayout(layout)};
await changeVariant('manual');
