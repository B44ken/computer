import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCPU,Machine,assemble,programs,ALLOWED,compile,evaluate} from '../public/gate-computer/core.mjs';
import {place,route,validateLayout} from '../public/gate-computer/layout.mjs';
const layouts={};
for(const variant of ['manual','auto']) {
  const cpu=buildCPU(variant);
  test(`${variant}: only scalar primitives and exactly 14 DFFs`,()=>{
    assert(cpu.cells.every(c=>ALLOWED.has(c.type)));
    assert.equal(cpu.cells.filter(c=>c.type==='DFF').length,14);compile(cpu);
    assert(cpu.cells.length<=110);
  });
  test(`${variant}: exhaustive 256 A × 256 M × 4 opcodes`,()=>{
    const m=new Machine(cpu);
    for(let a=0;a<256;a++)for(let b=0;b<256;b++)for(let op=0;op<4;op++){
      const pc=(a+b)&63,addr=(a^b)&63,inst=op*64+addr;
      m.setWord(cpu.ports.a,a);m.setWord(cpu.ports.pc,pc);m.settle(inst,b);
      const next=m.flops.map(c=>m.values[c.inputs[0]]);
      const nextWord=names=>names.reduce((s,n,i)=>s+(next[m.flops.findIndex(c=>c.output===n)]<<i),0);
      assert.equal(nextWord(cpu.ports.a),op===0?b:op===2?(a-b)&255:a);
      assert.equal(nextWord(cpu.ports.pc),op===3&&a===0?addr:(pc+1)&63);
      assert.equal(m.values.we,op===1?1:0);
    }
  });
  test(`${variant}: all PCs/targets; zero and every accumulator bit`,()=>{
    const m=new Machine(cpu),pcFlops=cpu.ports.pc.map(n=>m.flops.find(c=>c.output===n));
    for(let pc=0;pc<64;pc++)for(let target=0;target<64;target++)for(const a of [0,1,2,4,8,16,32,64,128,255]){
      m.setWord(cpu.ports.a,a);m.setWord(cpu.ports.pc,pc);m.settle(192+target,0);
      assert.equal(pcFlops.reduce((n,c,i)=>n+(m.values[c.inputs[0]]<<i),0),a===0?target:(pc+1)&63);
    }
  });
  test(`${variant}: complete programs and cycle-by-cycle reference`,()=>{
    for(const p of programs){
      const image=assemble(p.source).image,m=new Machine(cpu);m.powerOn(image);
      let a=0,pc=0;const ram=image.slice();
      for(let i=0;i<p.cycles;i++){
        const inst=ram[pc],op=inst>>6,addr=inst&63,b=ram[addr];let npc=(pc+1)&63;
        if(op===0)a=b;else if(op===1)ram[addr]=a;else if(op===2)a=(a-b)&255;else if(a===0)npc=addr;
        pc=npc;m.edge();assert.equal(m.a,a,p.name);assert.equal(m.pc,pc,p.name);assert.deepEqual(m.memory,ram,p.name);
      }
      for(const [addr,value] of Object.entries(p.expected))assert.equal(m.memory[+addr],value,p.name);
    }
  });
  test(`${variant}: random unified-memory/self-modifying programs`,()=>{
    let seed=0x81ee30;const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    for(let trial=0;trial<60;trial++){
      const ram=Uint8Array.from({length:64},()=>rand()>>>24),m=new Machine(cpu);m.powerOn(ram);
      let a=0,pc=0;
      for(let cycle=0;cycle<128;cycle++){
        const i=ram[pc],b=ram[i&63];let next=(pc+1)&63;
        switch(i>>6){case 0:a=b;break;case 1:ram[i&63]=a;break;case 2:a=(a-b)&255;break;case 3:if(a===0)next=i&63;}
        pc=next;m.edge();assert.equal(m.a,a);assert.equal(m.pc,pc);assert.deepEqual(m.memory,ram);
      }
    }
  });
  test(`${variant}: physical connectivity, crossovers, compactness`,()=>{
    const layout=route(place(cpu));layouts[variant]=layout;
    assert.deepEqual(validateLayout(layout),{ok:true,pins:layout.pins.length,nets:layout.metrics.nets,opens:0,shorts:0,overlaps:0});
    assert(layout.crosses.length>0);assert(layout.metrics.area<(variant==='auto'?30000:55000));
    assert(layout.metrics.wireLength<12000);
    // Removing a Cross must create a detectable short, not a cosmetic change.
    assert.throws(()=>validateLayout({...layout,crosses:layout.crosses.slice(1)}),/short/);
    const broken=structuredClone(layout);broken.crosses[0].h=broken.crosses[0].v;
    assert.throws(()=>validateLayout(broken));
    const reversed=structuredClone(layout);reversed.crosses[0].rotation=(reversed.crosses[0].rotation+180+45)%360-45;
    assert.throws(()=>validateLayout(reversed),/crossover/);
    const joined=structuredClone(layout);joined.crosses[0].channels[0].to='BL';
    assert.throws(()=>validateLayout(joined),/crossover/);
    const open=structuredClone(layout);open.edges=open.edges.filter(e=>!(e.a[0]===layout.pins[0].x&&e.a[1]===layout.pins[0].y||e.b[0]===layout.pins[0].x&&e.b[1]===layout.pins[0].y));
    assert.throws(()=>validateLayout(open));
  });
}
test('assembler rejects overlap, overflow, bad labels/opcodes/ranges',()=>{
  for(const source of ['lda 64','lda missing','x: .byte 0\nx: .byte 0','.org 63\n.byte 0\n.byte 0','.byte 1\n.org 0\n.byte 2','add 1','lda 1 2','.byte 256','.byte -129'])assert.throws(()=>assemble(source),source);
  assert.equal(assemble('start: lda value\njz start\nvalue: .byte -1').image[2],255);
});
test('zero detection sees every accumulator bit; no hidden CPU macro',()=>{
  const cpu=buildCPU(),m=new Machine(cpu);
  for(let i=0;i<8;i++){m.setWord(cpu.ports.a,1<<i);m.settle(192,0);assert.equal(m.values.zero,0);}
  assert.throws(()=>compile({...cpu,cells:[...cpu.cells,{id:'bad',output:'bad',type:'ALU',inputs:[]}]}),/bad cell/);
});
test('primitive truth tables including MUX pin order',()=>{
  for(let a=0;a<2;a++)for(let b=0;b<2;b++){
    assert.equal(evaluate('AND',[a,b]),a&&b);assert.equal(evaluate('NAND',[a,b]),1-(a&&b));
    assert.equal(evaluate('OR',[a,b]),a||b);assert.equal(evaluate('NOR',[a,b]),1-(a||b));
    assert.equal(evaluate('XOR',[a,b]),a!==b?1:0);assert.equal(evaluate('XNOR',[a,b]),a===b?1:0);
    for(let s=0;s<2;s++)assert.equal(evaluate('MUX',[a,b,s]),s?b:a);
  }
});
