import { useState } from 'react'
import { switchModes, switchCircuit, resolveSwitches, SwitchMode, Level } from '../../lib/course/transistors'
const paint=(v:Level)=>v===1?'#69d39a':v===0?'#a9c3ff':v==='X'?'#ff7d7d':'#7b8089'
export function Transistors({onPass}:{onPass:()=>void}){
    const [mode,setMode]=useState<SwitchMode>('not'),[a,setA]=useState<0|1>(0),[b,setB]=useState<0|1>(0),[seen,setSeen]=useState(0)
    const c=switchCircuit(mode),values=resolveSwitches(c.switches,a,b),out=values.out
    const visit=(m:SwitchMode,av:0|1,bv:0|1)=>{if(m==='nand')setSeen(prev=>{const n=prev|(1<<(av*2+bv));return n})}
    const change=(m:SwitchMode,av:0|1,bv:0|1)=>{setMode(m);setA(av);setB(bv);visit(m,av,bv)}
    return <section className="transistor-box" aria-label="transistor experiment">
        <div className="lab-head"><div><span className="eyebrow">switch-level experiment</span><h3>follow the conducting path</h3></div><span className="badge">ideal model</span></div>
        <div className="switch-tabs">{switchModes.map(m=><button key={m} aria-pressed={mode===m} onClick={()=>change(m,a,b)}>{m}</button>)}</div>
        <div className="switch-controls"><button aria-label="transistor input a" aria-pressed={!!a} onClick={()=>change(mode,a?0:1,b)}>a <strong>{a}</strong></button>{['nand','nor','or'].includes(mode)&&<button aria-label="transistor input b" aria-pressed={!!b} onClick={()=>change(mode,a,b?0:1)}>b <strong>{b}</strong></button>}
            <output data-testid="switch-output" style={{color:paint(out)}}>out = {out} <small>{out==='Z'?'floating':out==='X'?'supply short':out?'connected high':'connected low'}</small></output></div>
        <svg viewBox={`0 0 ${c.width} ${c.height}`} role="img" aria-label={`${mode} transistor network, output ${out}`} className="switch-svg">
            {c.segments.map((s,i)=><polyline key={i} points={s.points.map(p=>p.join(',')).join(' ')} fill="none" stroke={paint(values[s.net])} strokeWidth={3}/>)}
            {c.switches.map((t,i)=>{const on=values[t.gate]===(t.kind==='n'?1:0);return <g key={i} transform={`translate(${t.x},${t.y})`}>
                <path d="M0 -24 V-14 M0 14 V24" fill="none" stroke={on?paint(values[t.from]):'#8b9098'} strokeWidth={3}/>
                <circle cy={-14} r={3} fill="#181b21" stroke="#aab0ba"/><circle cy={14} r={3} fill="#181b21" stroke="#aab0ba"/>
                <path d={on?'M0 -14 V14':'M0 -14 L12 10'} stroke={on?'#ead39a':'#727883'} strokeWidth={3}/>
                <path d="M-30 0 H-16 M-12 -12 V12" stroke={paint(values[t.gate])} strokeWidth={2}/>
                {t.kind==='p'&&<circle cx={-17} cy={0} r={4} fill="#181b21" stroke={paint(values[t.gate])} strokeWidth={2}/>}
                {t.gate!=='nor'&&<text x={-37} y={5} textAnchor="end" fill="#e1e5eb" fontSize={14}>{t.gate}</text>}
                <text x={23} y={-2} fill="#e1e5eb" fontSize={14}>{t.kind}-channel</text><text x={23} y={16} fill={on?'#ead39a':'#9aa2ad'} fontSize={13}>{on?'on':'off'}</text>
            </g>})}
            {mode!=='n switch'&&<text x={mode==='or'?240:280} y={40} textAnchor="middle" fill={paint(1)} fontSize={16}>VDD · 1</text>}
            {mode!=='p switch'&&<text x={mode==='or'?240:280} y={493} textAnchor="middle" fill={paint(0)} fontSize={16}>ground · 0</text>}
            {mode==='or'&&<><text x={650} y={40} textAnchor="middle" fill={paint(1)} fontSize={16}>VDD · 1</text><text x={650} y={493} textAnchor="middle" fill={paint(0)} fontSize={16}>ground · 0</text><text x={400} y={269} fill={paint(values.nor)} fontSize={14}>nor = {values.nor}</text></>}
            <circle cx={mode==='or'?740:480} cy={250} r={7} fill={paint(out)}/><text x={mode==='or'?750:490} y={255} fill={paint(out)} fontSize={17}>out</text>
        </svg>
        <p className="model-note">ideal controlled switches. gate control is electrically insulated from the channel. no analog current, threshold drop, leakage or timing is simulated. gray = floating, blue = low, green = high.</p>
        <div className="experiment-check"><span>nand combinations visited</span><div>{[0,1,2,3].map(n=><span className={seen&(1<<n)?'visited':''} key={n}>{n>>1}{n&1} {seen&(1<<n)?'✓':'·'}</span>)}</div><button disabled={seen!==15} onClick={onPass}>record experiment</button></div>
    </section>
}
