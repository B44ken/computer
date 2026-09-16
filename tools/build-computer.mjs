import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCPU,Machine,assemble,programs,ALLOWED} from '../public/gate-computer/core.mjs';
import {place,route,validateLayout} from '../public/gate-computer/layout.mjs';
import {svgFile} from '../public/gate-computer/view.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function verilog(cpu) {
  const name=n=>n==='clk'?'clk':n.startsWith('inst[')?n:n.startsWith('data[')?n.replace('data','in_mem'):n==='0'||n==='1'?`1'b${n}`:'n_'+n.replace(/\W/g,'_');
  const out=[`module stupid_${cpu.variant}(input wire clk, input wire [7:0] inst, in_mem, output wire we, output wire [7:0] out_mem, output wire [5:0] out_adr, out_pc);`];
  for(const c of cpu.cells){if(!ALLOWED.has(c.type))throw Error('non-primitive');out.push(`  wire ${name(c.output)};`);}
  cpu.cells.forEach((c,i)=>out.push(`  ${c.type} g${i}(${[...c.inputs,c.output].map(name).join(', ')});`));
  for(const [bus,names] of [['out_mem',cpu.ports.a],['out_pc',cpu.ports.pc]])names.forEach((n,i)=>out.push(`  assign ${bus}[${i}] = ${name(n)};`));
  out.push(`  assign out_adr = inst[5:0];\n  assign we = ${name(cpu.ports.we)};\nendmodule`);return out.join('\n');
}
export const primitives=`module AND(input a,b,output q); assign q=a&b; endmodule
module NAND(input a,b,output q); assign q=~(a&b); endmodule
module OR(input a,b,output q); assign q=a|b; endmodule
module NOR(input a,b,output q); assign q=~(a|b); endmodule
module XOR(input a,b,output q); assign q=a^b; endmodule
module XNOR(input a,b,output q); assign q=~(a^b); endmodule
module NOT(input a,output q); assign q=~a; endmodule
module MUX(input a,b,s,output q); assign q=s?b:a; endmodule
module DFF(input d,clk,output reg q=0); always @(posedge clk) q<=d; endmodule\n`;
export function standalone() {
  const dir=path.join(root,'public/gate-computer');
  const code=['core.mjs','layout.mjs','view.mjs','app.mjs'].map(f=>fs.readFileSync(path.join(dir,f),'utf8').replace(/^import .*?;\n/gm,'').replace(/\bexport (?=(?:const|function|class)\b)/g,'')).join('\n\n');
  return fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('<script type="module" src="./app.mjs"></script>',`<script type="module">\n${code}\n</script>`);
}
export function build(dest=path.join(root,'build/gate-computer')) {
  fs.mkdirSync(dest,{recursive:true});const reports={};
  fs.writeFileSync(path.join(dest,'gate-computer.html'),standalone());
  fs.writeFileSync(path.join(dest,'gates.v'),'`default_nettype none\n'+primitives+['manual','auto'].map(v=>verilog(buildCPU(v))).join('\n')+'\n`default_nettype wire\n');
  fs.copyFileSync(path.join(root,'verilog/memory.v'),path.join(dest,'memory.v'));
  for(const variant of ['manual','auto']) {
    const netlist=buildCPU(variant),layout=route(place(netlist)),machine=new Machine(netlist);
    machine.powerOn(assemble(programs[0].source).image);
    fs.writeFileSync(path.join(dest,`${variant}.json`),JSON.stringify({schema:'gate-computer/v1',netlist,layout,memory:[...machine.memory],a:machine.a,pc:machine.pc,cycles:machine.cycles}));
    fs.writeFileSync(path.join(dest,`${variant}.svg`),svgFile(layout,machine.values));
    reports[variant]={...layout.metrics,validation:validateLayout(layout)};
  }
  programs.forEach((p,i)=>{
    fs.writeFileSync(path.join(dest,`program-${i}.asm`),p.source+'\n');
    fs.writeFileSync(path.join(dest,`program-${i}.hex`),[...assemble(p.source).image].map(b=>b.toString(16).padStart(2,'0')).join('\n')+'\n');
    const m=new Machine();m.powerOn(assemble(p.source).image);const rows=['cycle,pc_before,a_before,inst,data,pc_after,a_after,write_address,write_value'];
    for(let j=0;j<p.cycles;j++){const e=m.edge();rows.push([e.cycle,e.before.pc,e.before.a,e.before.inst,e.before.data,e.after.pc,e.after.a,e.write?.address??'',e.write?.value??''].join(','));}
    fs.writeFileSync(path.join(dest,`program-${i}-trace.csv`),rows.join('\n')+'\n');
  });
  fs.writeFileSync(path.join(dest,'layout-report.json'),JSON.stringify(reports,null,2));return reports;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(build(process.argv[2]),null,2));
