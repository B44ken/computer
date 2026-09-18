import { useEffect, useState } from 'react'
import { doubleStarter,doubleSolution,checkProgram } from '../../lib/course/program-check'
import { assemble } from '../../lib/computer/programs'
export function Programming({onResult}:{onResult:(ok:boolean)=>void}){
    const [source,setSource]=useState(doubleStarter),[rows,setRows]=useState<ReturnType<typeof checkProgram>>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[listing,setListing]=useState<ReturnType<typeof assemble>['listing']>([])
    useEffect(()=>{try{setSource(localStorage.getItem('build-computer:program:v1')||doubleStarter)}catch{}},[])
    const edit=(s:string)=>{setSource(s);setRows([]);onResult(false);try{localStorage.setItem('build-computer:program:v1',s)}catch{}}
    const test=()=>{setBusy(true);setError('');setTimeout(()=>{try{setListing(assemble(source).listing);const r=checkProgram(source);setRows(r);onResult(r.every(r=>r.ok))}catch(e){setError((e as Error).message);onResult(false)}finally{setBusy(false)}},30)}
    return <section className="program-lab" aria-label="programming exercise"><div className="lab-head"><div><span className="eyebrow">final software challenge</span><h3>double a byte. no add instruction.</h3></div><span className="badge">6 inputs</span></div>
        <p>input: memory[50]. output: memory[60]. leave a=0 in a self-loop within 512 instructions. tests execute the merged native gate computer, not an instruction emulator.</p>
        <label className="sr-only" htmlFor="program-source">your assembly program</label><textarea id="program-source" spellCheck={false} value={source} onChange={e=>edit(e.target.value)}/>
        <div className="lab-actions"><button className="accent" disabled={busy} onClick={test}>{busy?'running gate-level tests…':'test program'}</button><button onClick={()=>edit(doubleStarter)}>reset starter</button><button onClick={()=>{try{setListing(assemble(source).listing);setError('')}catch(e){setError((e as Error).message)}}}>assemble only</button><a href="/computer" target="_blank" rel="noreferrer">step in the workbench ↗</a></div>
        {error&&<p role="alert" className="error">{error}</p>}
        {!!rows.length&&<div className="scroll-table"><table><caption>independent test images · result at memory[60]</caption><thead><tr><th>x</th><th>expected</th><th>actual</th><th>edges</th><th>result</th></tr></thead><tbody>{rows.map(r=><tr key={r.input}><td>{r.input}</td><td>{r.expected}</td><td>{r.actual}</td><td>{r.edges}</td><td>{r.ok?'pass':r.parked?'wrong value':'did not park'}</td></tr>)}</tbody></table><output className="lab-status" aria-live="polite">{rows.every(r=>r.ok)?'all six inputs passed.':'some inputs failed. trace the first failing case.'}</output></div>}
        {!!listing.length&&<details><summary>assembled bytes and addresses</summary><pre>{listing.map(l=>`${l.address.toString().padStart(2)}  ${l.byte.toString(16).padStart(2,'0')}  ${l.source}`).join('\n')}</pre></details>}
        <details><summary>hint</summary><p>store −x in a temporary byte. then subtract that temporary from x. put temporaries outside the instruction bytes.</p></details>
        <details><summary>worked solution</summary><pre>{doubleSolution}</pre><button onClick={()=>edit(doubleSolution)}>load worked solution</button></details>
    </section>
}
