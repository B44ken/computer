require('./register-ts.cjs');
const fs=require('node:fs'),path=require('node:path');
const {buildComputer,powerOn,step,word}=require('../lib/computer');
const {validateComputer}=require('../lib/computer/validate');
const {serializeCircuit}=require('../lib/serialization');
const {assemble,programs}=require('../lib/computer/programs');
const primitives=`module AND(input a,b,output q); assign q=a&b; endmodule
module NAND(input a,b,output q); assign q=~(a&b); endmodule
module OR(input a,b,output q); assign q=a|b; endmodule
module NOR(input a,b,output q); assign q=~(a|b); endmodule
module XOR(input a,b,output q); assign q=a^b; endmodule
module XNOR(input a,b,output q); assign q=~(a^b); endmodule
module NOT(input a,output q); assign q=~a; endmodule
module MUX(input a,b,s,output q); assign q=s?b:a; endmodule
module DFF(input d,clk,output reg q=0); always @(posedge clk) q<=d; endmodule\n`;
function verilog(cpu){
    const c=cpu.circuit,gates=c.gates.map(g=>g.item),ids=new Map(gates.map((g,i)=>[g,i]));
    const signal=(g,p)=>`n${ids.get(g)}_${p}`;
    const input=(g,p)=>{const from=c.connections.find(c=>c.to===g&&c.toPin===p);if(!from)throw Error('open HDL pin');return signal(from.from,from.fromPin)};
    const lines=[`module stupid_${cpu.variant}(input wire clk, input wire [7:0] inst, in_mem, output wire we, output wire [7:0] out_mem, output wire [5:0] out_adr, out_pc);`];
    for(const g of gates)for(const p in g.pins)if(g.pins[p].type==='out')lines.push(`  wire ${signal(g,p)};`);
    for(const g of gates){
        if(g===cpu.clock){lines.push(`  assign ${signal(g,'Y')} = clk;`);continue}
        if(g===cpu.memory){for(let i=0;i<8;i++){lines.push(`  assign ${signal(g,'I'+i)} = inst[${i}];`);lines.push(`  assign ${signal(g,'M'+i)} = in_mem[${i}];`)}continue}
        if(g.type==='Cross'){lines.push(`  assign ${signal(g,'BR')} = ${input(g,'TL')};`,`  assign ${signal(g,'BL')} = ${input(g,'TR')};`);continue}
        const pins=g.type==='DFF'?['D','CLK']:g.type==='MUX'?['A','B','S']:g.type==='NOT'?['A']:['A','B'];
        if(!['AND','NAND','OR','NOR','XOR','XNOR','NOT','MUX','DFF'].includes(g.type))throw Error('non-primitive CPU gate');
        lines.push(`  ${g.type} g${ids.get(g)}(${[...pins.map(p=>input(g,p)),signal(g,g.type==='DFF'?'Q':'Y')].join(', ')});`);
    }
    for(const [bus,prefix,n]of [['out_mem','D',8],['out_pc','PC',6],['out_adr','ADR',6]])for(let i=0;i<n;i++)lines.push(`  assign ${bus}[${i}] = ${input(cpu.memory,prefix+i)};`);
    lines.push(`  assign we = ${input(cpu.memory,'WE')};`,'endmodule');return lines.join('\n');
}
function build(dest=path.resolve(__dirname,'../build/gate-computer')){
    fs.mkdirSync(dest,{recursive:true});let hdl='`default_nettype none\n'+primitives;const reports={};
    for(const variant of ['manual','auto']){
        const cpu=buildComputer(variant);reports[variant]={...cpu.layout.metrics,...validateComputer(cpu)};
        fs.writeFileSync(path.join(dest,`${variant}.circuit.json`),JSON.stringify(serializeCircuit(cpu.circuit)));
        hdl+=verilog(cpu)+'\n';
    }
    fs.writeFileSync(path.join(dest,'gates.v'),hdl+'`default_nettype wire\n');
    fs.copyFileSync(path.resolve(__dirname,'../verilog/memory.v'),path.join(dest,'memory.v'));
    const cpu=buildComputer('manual');
    programs.forEach((program,i)=>{
        const image=assemble(program.source).image;powerOn(cpu,image);
        fs.writeFileSync(path.join(dest,`program-${i}.asm`),program.source+'\n');
        fs.writeFileSync(path.join(dest,`program-${i}.hex`),[...image].map(n=>n.toString(16).padStart(2,'0')).join('\n')+'\n');
        const rows=['cycle,pc_before,a_before,pc_after,a_after,write_address,write_value'];
        const pins=(prefix,n)=>{let v=0;for(let j=0;j<n;j++)if(cpu.memory.get(prefix+j))v|=1<<j;return v};
        for(let j=0;j<program.cycles;j++){
            const pc=word(cpu.pc),a=word(cpu.a),write=cpu.memory.get('WE'),address=pins('ADR',6),data=pins('D',8);step(cpu);
            rows.push([cpu.cycles,pc,a,word(cpu.pc),word(cpu.a),write?address:'',write?data:''].join(','));
        }
        fs.writeFileSync(path.join(dest,`program-${i}-trace.csv`),rows.join('\n')+'\n');
    });
    fs.writeFileSync(path.join(dest,'validation.json'),JSON.stringify(reports,null,2));return reports;
}
module.exports={build,verilog};
if(require.main===module)console.log(JSON.stringify(build(process.argv[2]),null,2));
