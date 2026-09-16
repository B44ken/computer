import * as React from 'react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { buildComputer,clockCycle,readWord } from '../lib/computer/build'
import { nativeJSON,nativeSVG,nativeVerilog,primitiveVerilog } from '../lib/computer/export'
import { validateGeometry } from '../lib/computer/validate'
import { assemble,programs } from '../lib/computer/programs'
;(globalThis as any).React=React
const dest=process.argv[2]||'build/native-computer'
fs.mkdirSync(dest,{recursive:true})
const reports={},hdls=[primitiveVerilog]
for(const variant of ['manual','auto'] as const){
    const c=buildComputer(variant,assemble(programs[0].source).image)
    reports[variant]={...c.metrics,...c.validation,...validateGeometry(c)}
    fs.writeFileSync(path.join(dest,`${variant}.json`),JSON.stringify(nativeJSON(c)))
    fs.writeFileSync(path.join(dest,`${variant}.svg`),nativeSVG(c))
    hdls.push(nativeVerilog(c))
    const rows=['cycle,a,pc,write_address,write_data']
    for(let i=0;i<12;i++){const writes=c.memory.writes;clockCycle(c);const addr=c.memory.lastWrite;rows.push([i+1,readWord(c.byName,'a',8),readWord(c.byName,'pc',6),c.memory.writes>writes?addr:'',c.memory.writes>writes?c.memory.bytes[addr!]:''].join(','))}
    fs.writeFileSync(path.join(dest,`${variant}-trace.csv`),rows.join('\n')+'\n')
}
fs.writeFileSync(path.join(dest,'computer.v'),hdls.join('\n'))
fs.copyFileSync('verilog/memory.v',path.join(dest,'memory.v'))
programs.forEach((p,i)=>{
    fs.writeFileSync(path.join(dest,`program-${i}.asm`),p.source+'\n')
    fs.writeFileSync(path.join(dest,`program-${i}.hex`),[...assemble(p.source).image].map(b=>b.toString(16).padStart(2,'0')).join('\n')+'\n')
})
fs.writeFileSync(path.join(dest,'report.json'),JSON.stringify(reports,null,2))
console.log(JSON.stringify(reports,null,2))
