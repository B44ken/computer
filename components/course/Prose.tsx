import { Fragment } from 'react'
export function Inline({text}:{text:string}){return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((s,i)=>s.startsWith('**')?<strong key={i}>{s.slice(2,-2)}</strong>:s.startsWith('`')?<code key={i}>{s.slice(1,-1)}</code>:s)}</>}
export function Prose({body,widget}:{body:string,widget:(name:string)=>React.ReactNode}){
    const chunks=body.split(/(```[\s\S]*?```|@@[\w:-]+)/g)
    return <>{chunks.map((part,i)=>{
        if(part.startsWith('@@'))return <Fragment key={i}>{widget(part.slice(2))}</Fragment>
        if(part.startsWith('```')){const code=part.slice(part.indexOf('\n')+1,-3).trimEnd(),lang=part.slice(3,part.indexOf('\n'));return <div className="code-block" key={i}><span>{lang||'notes'}</span><pre><code>{code}</code></pre></div>}
        return <Fragment key={i}>{part.trim().split(/\n\s*\n/).filter(Boolean).map((p,j)=>p.startsWith('## ')?<h2 key={j}>{p.slice(3)}</h2>:p.startsWith('### ')?<h3 key={j}>{p.slice(4)}</h3>:<p key={j}><Inline text={p.replaceAll('\n',' ')}/></p>)}</Fragment>
    })}</>
}
