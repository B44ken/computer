import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { lessons, Lesson } from '../../lib/course/lessons'
import { Progress, readProgress, emptyProgress, progressKey, isComplete } from '../../lib/course/progress'

export function useProgress(){
    const [progress,setProgress]=useState<Progress>(emptyProgress),[ready,setReady]=useState(false),[error,setError]=useState('')
    useEffect(()=>{try{setProgress(readProgress(localStorage.getItem(progressKey)))}catch{setError('progress storage is unavailable in this browser.')}setReady(true)},[])
    useEffect(()=>{if(!ready)return;try{localStorage.setItem(progressKey,JSON.stringify(progress))}catch{setError('progress could not be saved. keep this page open or enable browser storage.')}},[progress,ready])
    const lab=(id:string,ok:boolean)=>setProgress(p=>p.labs[id]===ok?p:{...p,labs:{...p.labs,[id]:ok}})
    const answer=(id:string,value:number)=>setProgress(p=>({...p,answers:{...p.answers,[id]:value}}))
    return {progress,lab,answer,error,ready}
}
export function CourseShell({lesson,progress,children}:{lesson?:Lesson,progress:Progress,children:React.ReactNode}){
    const router=useRouter(),count=lessons.filter(l=>isComplete(l,progress)).length
    return <div className="course-shell"><a href="#lesson-content" className="skip-link">skip to lesson</a>
        <header className="course-header"><Link href="/learn" className="course-brand">computer<span> / a build-it-yourself course</span></Link><nav><span data-testid="course-progress">{count} / {lessons.length} complete</span><Link href="/computer">workbench ↗</Link></nav></header>
        <div className="mobile-chapters"><label htmlFor="chapter-select">chapter</label><select id="chapter-select" value={lesson?.slug||''} onChange={e=>router.push(e.target.value?`/learn/${e.target.value}`:'/learn')}><option value="">course overview</option>{lessons.map((l,i)=><option key={l.slug} value={l.slug}>{String(i+1).padStart(2,'0')} · {l.title}{isComplete(l,progress)?' ✓':''}</option>)}</select></div>
        <div className="course-layout"><aside className="course-sidebar"><Link className="back-to-course" href="/learn">← all lessons</Link><nav aria-label="chapters">{lessons.map((l,i)=><div key={l.slug}>{(!i||l.phase!==lessons[i-1].phase)&&<p className="phase-label">{l.phase}</p>}<Link href={`/learn/${l.slug}`} aria-current={lesson?.slug===l.slug?'page':undefined}><span className="chapter-number">{isComplete(l,progress)?'✓':String(i+1).padStart(2,'0')}</span><span>{l.title}</span></Link></div>)}</nav><p className="sidebar-note">no account. no black-box cpu. build with the same gates you can inspect in the workbench.</p></aside>
        <main className="course-content" id="lesson-content">{children}</main></div><footer className="course-footer"><span>switches → gates → arithmetic → state → a computer</span><Link href="/computer">open the native gate editor ↗</Link></footer>
    </div>
}
export function Overview(){
    const {progress,error}=useProgress()
    const first=lessons.find(l=>!isComplete(l,progress))||lessons[0]
    return <CourseShell progress={progress}><div className="course-hero"><p className="eyebrow">from a transistor to a program</p><h1>how to build<br/>a computer.</h1><p className="hero-deck">not a processor-shaped box. an actual machine made of switches, gates, wires, and fourteen flip-flops. build the pieces, then make them run your code.</p><div className="hero-actions"><Link className="button accent" href={`/learn/${first.slug}`}>{Object.keys(progress.answers).length?'continue learning':'start with transistors'} →</Link><Link href="/computer">see what we’re building ↗</Link></div><div className="course-facts"><span><b>13</b> written lessons</span><span><b>18</b> native circuit labs</span><span><b>26</b> questions</span></div></div>
        {error&&<p className="error">{error}</p>}
        <section className="course-intro"><h2>the idea is to remove the magic.</h2><p>we’ll start with voltage-controlled switches, derive the familiar logic gates, use them to do arithmetic, and add just enough memory and control to execute four instructions. every gate-level lab runs in this repository’s existing simulator. erasing a wire really does change the answer.</p><p>you do not need to know verilog or electronics. each chapter has a worked circuit, a hands-on build or repair, and questions with explanations. progress and circuit edits stay in your browser. chapters remain open: follow the sequence, or jump to the part you’re curious about.</p></section>
        <section className="course-outline" aria-label="course syllabus">{lessons.map((l,i)=><Link key={l.slug} href={`/learn/${l.slug}`} className={isComplete(l,progress)?'complete':''}><span className="outline-number">{String(i+1).padStart(2,'0')}</span><div><h2>{l.title}</h2><p>{l.deck}</p></div><span className="outline-meta">{isComplete(l,progress)?'✓ complete':`${l.minutes} min`}<span>→</span></span></Link>)}</section>
        <section className="course-intro"><h2>what “complete” means here</h2><p>the final cpu has an eight-bit accumulator, a six-bit program counter, and one 64-byte shared code/data memory. there are no hidden ALU or register components. the transistor explorer is an explicitly ideal switch model; later boards use the actual native Gate, Wire, and Circuit objects.</p><p>this teaches digital logic and an educational processor—not transistor fabrication, analog device simulation, or electrical sign-off for manufacturing. by the end, you can trace an instruction through the wires, repair the computer, and write a program it executes.</p></section>
    </CourseShell>
}
