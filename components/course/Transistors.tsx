import { useEffect,useState } from 'react'
import { switchCircuit,switchModes,SwitchMode,resolveSwitches,Level } from '../../lib/course/transistors'

const color=(v:Level)=>v===1?'#77d9a2':v===0?'#b6c9ff':v==='X'?'#ff9b8b':'#737982'
export const Transistors=({onPass}:{onPass:()=>void})=>{
    const [mode,setMode]=useState<SwitchMode>('not'),[a,setA]=useState<0|1>(0),[b,setB]=useState<0|1>(0),[seen,setSeen]=useState<string[]>([])
    const network=switchCircuit(mode),values=resolveSwitches(network.switches,a,b)
    useEffect(()=>{if(mode==='nand')setSeen(s=>s.includes(`${a}${b}`)?s:[...s,`${a}${b}`])},[mode,a,b])
    return <section className="transistor-lab" aria-label="transistor experiment"><div className="lab-heading"><div><span className="eyebrow">switch-level experiment</span><h3>follow the conducting path</h3></div><span className="pill">ideal model</span></div>
        <div className="lab-buttons">{switchModes.map(m=><button key={m} onClick={()=>setMode(m)} aria-pressed={mode===m}>{m}</button>)}</div>
        <div className="transistor-controls"><button onClick={()=>setA(a?0:1)}>a {a}</button>{['nand','nor','or'].includes(mode)&&<button onClick={()=>setB(b?0:1)}>b {b}</button>}<div><strong style={{color:color(values.out)}}>out = {values.out}</strong><span>{values.out==='Z'?'floating':values.out===1?'connected high':values.out===0?'connected low':'supply conflict'}</span></div></div>
        <svg role="img" aria-label={`${mode} transistor network; output ${values.out}`} viewBox={`0 0 ${network.width} ${network.height}`} className="transistor-svg">
            {network.segments.map((s,i)=><polyline key={i} points={s.points.map(p=>p.join(',')).join(' ')} fill="none" stroke={color(values[s.net])} strokeWidth="3" strokeLinejoin="round"/>)}
            {network.switches.map((t,i)=>{const on=values[t.gate]===(t.kind==='n'?1:0),x=t.x,y=t.y;return <g key={i}>
                <title>{`${t.kind}-channel controlled by ${t.gate}: ${on?'conducting':'open'}`}</title>
                <path d={`M${x},${y-24} L${x},${y-9} M${x},${y+9} L${x},${y+24}`} stroke={color(values[t.from])} strokeWidth="3"/>
                <path d={on?`M${x},${y-9} V${y+9}`:`M${x},${y-9} L${x+10},${y+7}`} stroke={on?'#f4d7a1':'#666d77'} strokeWidth="3"/>
                <path d={`M${x-30},${y-9} V${y+9}`} stroke="#b6c9ff" strokeWidth="3"/>
                {t.kind==='p'&&<circle cx={x-37} cy={y} r="4" fill="none" stroke="#b6c9ff" strokeWidth="2"/>}
                {t.gate!=='nor'&&<text x={x-47} y={y+5} textAnchor="end" className="transistor-input">{t.gate} →</text>}
                <text x={x+22} y={y-2} className="transistor-label">{t.kind}-channel</text><text x={x+22} y={y+17} className="transistor-sub">{on?'on':'off'}</text>
            </g>})}
            {mode!=='n switch'&&<text x={mode==='or'?240:280} y="38" textAnchor="middle" className="rail-label">VDD · 1</text>}
            {mode!=='p switch'&&<text x={mode==='or'?240:280} y="491" textAnchor="middle" className="ground-label">ground · 0</text>}
            {mode==='or'&&<><text x="650" y="38" textAnchor="middle" className="rail-label">VDD · 1</text><text x="650" y="491" textAnchor="middle" className="ground-label">ground · 0</text><text x="455" y="270" textAnchor="end" fill={color(values.nor)} fontSize="12">nor = {values.nor}</text></>}
            <circle cx={mode==='or'?740:480} cy="250" r="5" fill={color(values.out)}/><text x={mode==='or'?750:490} y="255" fill={color(values.out)} fontSize="14">out</text>
        </svg>
        <p className="model-note">ideal controlled switches. gate control is electrically insulated from the channel. no analog current, threshold drop, leakage or timing is simulated. gray = floating, blue = low, green = high.</p>
        <div className="lab-footer"><span>nand combinations visited: {['00','01','10','11'].map(v=><code key={v} className={seen.includes(v)?'visited':''}>{v}{seen.includes(v)?' ✓':' ·'}</code>)}</span><button onClick={onPass} disabled={seen.length<4}>record experiment</button></div>
    </section>
}
