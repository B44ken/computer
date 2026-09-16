import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
const dest='build/native-computer';fs.mkdirSync(dest,{recursive:true});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100'],{stdio:'inherit'});
let browser;
try {
  for(let i=0;i<100;i++) {try {if((await fetch('http://localhost:3100/computer')).ok)break;}catch{}if(i===99)throw Error('server not ready');await new Promise(r=>setTimeout(r,300));}
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3100/computer');
  await page.waitForFunction(()=>window.nativeComputer?.computer,{},{timeout:120000});
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.locator('[data-native-board]').count(),1);
  const report={};
  for(const variant of ['manual','auto']) {
    if(variant==='auto'){await page.locator('#auto').click();await page.waitForFunction(()=>window.nativeComputer.state.variant==='auto',{},{timeout:120000});}
    const programs=[];
    for(const [id,cycles,expected] of [[0,7,{60:255,61:42}],[1,40,{60:0}],[2,100,{60:42}],[3,200,{60:21,61:34}],[4,8,{4:197,60:0}]]) {
      await page.locator('#program').selectOption(String(id));
      await page.evaluate(n=>window.nativeComputer.step(n),cycles);
      const actual=await page.evaluate(()=>({memory:[...window.nativeComputer.computer.memory.bytes],error:window.nativeComputer.state.error}));
      assert.equal(actual.error,'');
      for(const [addr,value] of Object.entries(expected))assert.equal(actual.memory[addr],value,`${variant}/${id}/${addr}`);
      programs.push({id,cycles,passed:true});
    }
    await page.locator('#program').selectOption('0');await page.locator('#validate').click();
    assert.equal(await page.evaluate(()=>window.nativeComputer.state.error),'');
    await page.locator('aside').evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:`${dest}/${variant}-browser.png`});
    await page.locator('#focus-sub').click();await page.screenshot({path:`${dest}/${variant}-detail.png`});
    await page.locator('[data-gate="load_or_sub0"]').click();
    assert.equal(await page.evaluate(()=>window.nativeComputer.state.selected.name),'load_or_sub0');
    report[variant]={programs,metrics:await page.evaluate(()=>window.nativeComputer.computer.metrics)};
  }
  const before=await page.evaluate(()=>[...window.nativeComputer.computer.memory.bytes]);
  await page.locator('#source').fill('lda 99');await page.locator('#load').click();
  assert(await page.evaluate(()=>window.nativeComputer.state.error));
  assert.deepEqual(await page.evaluate(()=>[...window.nativeComputer.computer.memory.bytes]),before);
  await page.locator('#program').selectOption('0');
  page.once('dialog',d=>d.accept('2b'));await page.locator('[data-address="58"]').dblclick();
  assert.equal(await page.evaluate(()=>window.nativeComputer.computer.memory.bytes[58]),43);
  const download=page.waitForEvent('download');await page.locator('#export').click();await (await download).saveAs(`${dest}/browser-export.json`);
  const json=JSON.parse(fs.readFileSync(`${dest}/browser-export.json`,'utf8'));
  assert.equal(json.schema,'native-circuit/v1');assert(json.gates.some(g=>g.type==='Cross'));assert(json.wires.length>100);
  await page.locator('#source').fill('lda 56\n.org 56\n.byte 42');await page.locator('#load').click();
  const index=await page.evaluate(()=>{
    const c=window.nativeComputer.computer,g=c.byName.get('a[1]'),net=c.circuit.nets.find(n=>n.receivers.some(r=>r.item===g&&r.pin==='D'));
    const length=w=>w.path.slice(1).reduce((s,p,i)=>s+p.sub(w.path[i]).len(),0);
    const wire=net.wires.slice().sort((a,b)=>length(b)-length(a))[0];return c.circuit.wires.findIndex(w=>w.item===wire);
  });
  const wireCount=await page.evaluate(()=>window.nativeComputer.computer.circuit.wires.length);
  await page.getByRole('button',{name:'Erase',exact:true}).click();
  await page.evaluate(()=>window.nativeComputer.board.current.focus([window.nativeComputer.computer.byName.get('a[1]')]));
  const point=await page.evaluate(i=>{
    const w=window.nativeComputer.computer.circuit.wires[i].item,svg=document.querySelector('[data-native-board]'),p=svg.createSVGPoint();
    for(let j=1;j<w.path.length;j++)for(const t of [.5,.25,.75]){
      p.x=w.path[j-1].x+(w.path[j].x-w.path[j-1].x)*t;p.y=w.path[j-1].y+(w.path[j].y-w.path[j-1].y)*t;
      const q=p.matrixTransform(svg.getScreenCTM());
      if(document.elementFromPoint(q.x,q.y)?.closest('[data-wire-index]')?.getAttribute('data-wire-index')===String(i))return {x:q.x,y:q.y};
    }throw Error('wire not visible');
  },index);
  await page.mouse.click(point.x,point.y);
  assert.equal(await page.evaluate(()=>window.nativeComputer.computer.circuit.wires.length),wireCount-1);
  await page.locator('#step').click();assert.equal(await page.locator('#reg-a').innerText(),'28');
  report.editing={eraseChanges42To40:true,memoryEdit:true,assemblyErrors:true,nativeExport:true};
  // The pre-existing native editor pages must still render with the shared Board.
  for(const route of ['/halfadder','/adder','/adder4','/stuff']){
    await page.goto('http://localhost:3100'+route);await page.waitForSelector('[data-native-board]');
  }
  assert.deepEqual(errors,[]);report.pageErrors=errors;
  fs.writeFileSync(`${dest}/browser-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser?.close();server.kill('SIGTERM');}
