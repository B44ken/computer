import fs from 'node:fs'
import path from 'node:path'
import Head from 'next/head'
import Link from 'next/link'
import type { GetStaticPaths, GetStaticProps } from 'next'
import { lessons, lessonBySlug } from '../../lib/course/lessons'
import { isComplete } from '../../lib/course/progress'
import type { LabId } from '../../lib/course/circuits'
import { CourseShell,useProgress } from '../../components/course/CourseShell'
import { Prose } from '../../components/course/Prose'
import { Transistors } from '../../components/course/Transistors'
import { CircuitLab } from '../../components/course/CircuitLab'
import { Programming } from '../../components/course/Programming'

export default function LessonPage({slug,body}:{slug:string,body:string}){
    const lesson=lessonBySlug(slug)!,index=lessons.indexOf(lesson),p=useProgress(),complete=isComplete(lesson,p.progress)
    const widget=(name:string)=>{
        if(name==='transistors')return <Transistors onPass={()=>p.lab('transistors',true)}/>
        if(name==='programming')return <Programming onResult={ok=>p.lab('programming',ok)}/>
        if(name.startsWith('lab:')){const id=name.slice(4) as LabId;return <CircuitLab key={id} id={id} passed={!!p.progress.labs[id]} onResult={ok=>p.lab(id,ok)}/>}
        return null
    }
    return <CourseShell lesson={lesson} progress={p.progress}><Head><title>{index+1}. {lesson.title} · build a computer</title><meta name="description" content={lesson.deck}/></Head>
        <article key={slug}><header className="lesson-title"><p className="eyebrow">lesson {String(index+1).padStart(2,'0')} / {lessons.length} <span>· about {lesson.minutes} minutes</span></p><h1>{lesson.title}</h1><p>{lesson.deck}</p><div className="lesson-goals"><b>by the end</b>{lesson.goals.map(g=><span key={g}>{g}</span>)}</div></header>
        <div className="lesson-prose"><Prose body={body} widget={widget}/></div>
        <section className="checkpoint" aria-label="lesson checkpoint"><div className="lab-head"><div><span className="eyebrow">before you move on</span><h2>check your understanding</h2></div><span className={`badge ${complete?'done':''}`} data-testid="lesson-completion">{complete?'✓ lesson complete':'checkpoint'}</span></div>
            {lesson.questions.map((q,i)=>{const id=`${slug}:${i}`,answer=p.progress.answers[id];return <fieldset key={id} className="question"><legend>{i+1}. {q.prompt}</legend>{q.choices.map((choice,n)=><label key={n} className={answer===n?'chosen':''}><input type="radio" name={id} checked={answer===n} onChange={()=>p.answer(id,n)}/><span>{choice}</span></label>)}{answer!==undefined&&<p role="status" className={answer===q.answer?'correct':'incorrect'}>{answer===q.answer?'yes. ':'not quite. '}{q.why}</p>}<details><summary>hint</summary><p>{q.hint}</p></details></fieldset>})}
            {!!lesson.labs.length&&<div className="required-labs"><b>build checkpoints</b>{lesson.labs.map(id=><span key={id} className={p.progress.labs[id]?'correct':''}>{p.progress.labs[id]?'✓':'○'} {id.replaceAll('-',' ')}</span>)}<p>complete the experiment/build checks and answer both questions to record this lesson. you can still visit any chapter.</p></div>}
            {p.error&&<p role="status" className="error">{p.error}</p>}
        </section>
        {!!lesson.sources.length&&<details className="references"><summary>technical references & model boundaries</summary><p>the explanations and exercises are written for this course. these references describe the underlying devices and tool commands; the four-instruction architecture is the local design in this repository.</p>{lesson.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}</details>}
        <nav className="lesson-nav" aria-label="lesson navigation">{index>0?<Link href={`/learn/${lessons[index-1].slug}`}>← {lessons[index-1].title}</Link>:<Link href="/learn">← course overview</Link>}{index+1<lessons.length?<Link href={`/learn/${lessons[index+1].slug}`}>next: {lessons[index+1].title} →</Link>:<Link href="/computer">open your computer ↗</Link>}</nav>
        </article>
    </CourseShell>
}
export const getStaticPaths:GetStaticPaths=async()=>({paths:lessons.map(l=>({params:{slug:l.slug}})),fallback:false})
export const getStaticProps:GetStaticProps=async({params})=>{
    const slug=String(params?.slug);if(!lessonBySlug(slug))return {notFound:true}
    return {props:{slug,body:fs.readFileSync(path.join(process.cwd(),'course',`${slug}.md`),'utf8')}}
}
