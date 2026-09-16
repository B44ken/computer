import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CircuitBoard, BoardView } from '../../components/CircuitBoard'
import { Toolbox, Tool } from '../../components/Toolbox'
import { useCircuit } from '../../hooks/useCircuit'
import { Circuit } from '../../lib/circuit'
import { DFFGate } from '../../components/gates/DFFGate'
import { loadComputer, snapshot as readSnapshot, Snapshot } from '../../lib/computer/load'
import { Layout } from '../../lib/computer/model'
import { technology } from '../../lib/computer/parts'
import { assemble, decode, programs } from '../../lib/computer/programs'
import styles from './computer.module.css'

const hex = (n: number) => n.toString(16).padStart(2, '0')
type Step = Snapshot & { cycle: number, nextA: number, write: { address: number, value: number } | null }

export default function ComputerPage() {
    const uc = useCircuit(() => new Circuit())
    const [mode, setMode] = useState<'manual' | 'auto'>('manual'), [programId, setProgramId] = useState(programs[0].id)
    const [source, setSource] = useState(programs[0].source.trim()), [assembly, setAssembly] = useState(() => assemble(programs[0].source))
    const [rig, setRig] = useState<ReturnType<typeof loadComputer> | null>(null), [layout, setLayout] = useState<Layout | null>(null)
    const [tool, setTool] = useState<Tool>('Interact'), [focus, setFocus] = useState<BoardView | null>(null)
    const [error, setError] = useState(''), [running, setRunning] = useState(false), [rate, setRate] = useState(4), [trace, setTrace] = useState<Step[]>([])
    const [custom, setCustom] = useState(false), [reload, setReload] = useState(0)
    const rigRef = useRef(rig); rigRef.current = rig
    const assemblyRef = useRef(assembly); assemblyRef.current = assembly
    const program = programs.find(p => p.id === programId)!
    useEffect(() => {
        let cancelled = false; setRunning(false); setRig(null); setError('')
        fetch(`/computer/${mode}.json`).then(r => { if (!r.ok) throw Error('could not load circuit'); return r.json() }).then((l: Layout) => {
            if (cancelled) return
            const r = loadComputer(l)
            r.memory.load(assemblyRef.current.image); r.circuit.reset()
            uc.setCircuit(r.circuit); setRig(r); setLayout(l); setFocus(null); setTool('Interact'); setTrace([])
        }).catch(e => { if (!cancelled) setError(String(e.message)) })
        return () => { cancelled = true }
    }, [mode, reload]) // eslint-disable-line react-hooks/exhaustive-deps
    const refresh = uc.interact
    const step = useCallback(() => {
        const r = rigRef.current
        if (!r) return
        try {
            const before = readSnapshot(r.memory)
            r.circuit.tick()
            setTrace(t => [...t.slice(-11), { ...before, cycle: r.circuit.cycles, nextA: readSnapshot(r.memory).a, write: r.memory.lastWrite }])
            refresh(); setError('')
        } catch (e) { setError(String(e)); setRunning(false) }
    }, [refresh])
    useEffect(() => {
        if (!running || !rig) return
        const timer = setInterval(() => {
            const state = readSnapshot(rig.memory)
            if (state.pc === assembly.labels.halt && state.a === 0) { setRunning(false); return }
            step()
        }, 1000 / rate)
        return () => clearInterval(timer)
    }, [running, rig, rate, assembly, step])
    useEffect(() => {
        const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); step() } }
        window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
    }, [step])
    const load = (text: string, isCustom: boolean) => {
        try {
            const a = assemble(text); rig?.memory.load(a.image); rig?.circuit.reset()
            setAssembly(a); setTrace([]); setRunning(false); setError(''); setCustom(isCustom); refresh()
        } catch (e) { setError(String((e as Error).message)) }
    }
    const teachingView = (section: string) => {
        if (!layout) return
        if (section === 'bit slice') { const c = layout.cells.find(c => c.id === 'pair.0')!; setFocus({ x: c.x - 8, y: c.y - 7, w: 55, h: 32 }); return }
        const re = section === 'accumulator' ? /^(a\.|pair\.|diff\.|borrow\.|not.a|load.sub|hold)/ : /^(pc\.|increment|carry)/
        const cells = layout.cells.filter(c => re.test(c.id))
        const x = Math.min(...cells.map(c => c.x)) - 5, y = Math.min(...cells.map(c => c.y)) - 5
        setFocus({ x, y, w: Math.max(...cells.map(c => c.x + technology[c.kind].width)) - x + 5,
            h: Math.max(...cells.map(c => c.y + technology[c.kind].height)) - y + 5 })
    }
    const snapshot = rig ? readSnapshot(rig.memory) : undefined, parked = snapshot?.pc === assembly.labels.halt && snapshot?.a === 0
    const correct = rig && Object.entries(program.expected).every(([a, v]) => rig.memory.bytes[Number(a)] === v)
    return <main className={styles.page}>
        <header className={styles.header}>
            <div><Link href="/" className={styles.back}>← logic simulator</Link><h1>stupid<span> / 14 flip-flops and some gates</span></h1></div>
            <div className={styles.tabs}><button aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>hand-built</button><button aria-pressed={mode === 'auto'} onClick={() => setMode('auto')}>autorouted</button></div>
        </header>
        <div className={styles.toolbar}>
            <button disabled={!rig} className={styles.primary} onClick={step}>step <kbd>space</kbd></button>
            <button disabled={!rig} onClick={() => setRunning(!running)}>{running ? 'pause' : 'run'}</button>
            <select aria-label="clock rate" value={rate} onChange={e => setRate(Number(e.target.value))}><option value={1}>1 hz</option><option value={4}>4 hz</option><option value={20}>20 hz</option><option value={100}>100 hz</option></select>
            <button disabled={!rig} onClick={() => { rig?.circuit.reset(); setTrace([]); setRunning(false); refresh() }}>reset</button>
            <button onClick={() => setReload(n => n + 1)}>restore wiring</button>
            <div className={styles.metrics}>{layout && rig ? `${layout.cells.length} cpu gates · ${rig.circuit.gates.filter(g => g.item instanceof DFFGate).length} dffs · ${layout.bridges.length} Cross · ${layout.width} × ${layout.height}` : 'loading circuit…'}</div>
        </div>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        <div className={styles.body}>
            <div className={styles.board}>
                <Toolbox tool={tool} setTool={setTool}/>
                {mode === 'manual' && <div className={styles.boardTools}>{['accumulator', 'counter', 'bit slice'].map(v => <button key={v} onClick={() => teachingView(v)}>{v}</button>)}<span>native gate editor · half-unit wiring grid</span></div>}
                {rig && layout ? <CircuitBoard {...uc} tool={tool} fitOnLoad focus={focus} clockControls={false} notes={layout.notes}
                    interact={() => { setRunning(false); setCustom(true); refresh() }}/>
                    : <div className={styles.loading}>loading the gate-level circuit…</div>}
            </div>
            <aside className={styles.panel}>
                <section><div className={styles.sectionTitle}>on the wires <span>cycle {rig?.circuit.cycles || 0}</span></div>
                    <div className={styles.registers}><div><label>a</label><strong data-testid="accumulator">{snapshot ? hex(snapshot.a) : '00'}</strong><small>{snapshot?.a.toString(2).padStart(8, '0') || '00000000'}</small></div><div><label>pc</label><strong data-testid="pc">{snapshot ? hex(snapshot.pc) : '00'}</strong><small>{snapshot?.pc.toString(2).padStart(6, '0') || '000000'}</small></div></div>
                    <div className={styles.instruction}><span>{snapshot ? decode(snapshot.inst) : '—'}</span><span>operand {snapshot?.operand ?? 0} · we {Number(snapshot?.we || false)}</span></div>
                    <p>{parked ? 'parked in the halt loop. JZ branches back to itself; there is no halt instruction.' : 'settle the wires, sample every dff, write memory, then commit all 14 bits together.'}</p>
                </section>
                <section><div className={styles.sectionTitle}>program <span>{parked && !custom ? correct ? '✓ expected result' : '✗ unexpected result' : '64 bytes total'}</span></div>
                    <select aria-label="program" value={programId} onChange={e => { const p = programs.find(p => p.id === e.target.value)!; setProgramId(p.id); setSource(p.source.trim()); load(p.source, false) }}>{programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                    <p>{program.description}</p>
                    <details><summary>assembly editor</summary><textarea aria-label="assembly source" value={source} onChange={e => setSource(e.target.value)} spellCheck={false}/><button onClick={() => load(source, source.trim() !== program.source.trim())}>assemble & load</button></details>
                </section>
                <section><div className={styles.sectionTitle}>memory <span>2 asynchronous reads · 1 clocked write</span></div>
                    <div className={styles.memory}>{Array.from({ length: 64 }, (_, i) => <div key={i} className={`${styles.byte} ${snapshot?.pc === i ? styles.pcByte : ''} ${snapshot?.address === i ? styles.operandByte : ''}`}>
                        <label htmlFor={`mem-${i}`}>{i}</label><input id={`mem-${i}`} aria-label={`memory ${i}`} title={`${i}: ${rig ? decode(rig.memory.bytes[i]) : ''}`} type="number" min={0} max={255}
                            key={`${i}-${rig?.memory.bytes[i]}`} defaultValue={rig?.memory.bytes[i] || 0}
                            onBlur={e => { const n = Number(e.target.value); if (!rig || !Number.isInteger(n) || n < 0 || n > 255) { e.target.value = String(rig?.memory.bytes[i] || 0); return }; if (rig.memory.bytes[i] === n) return; rig.memory.bytes[i] = n; rig.circuit.update(); setCustom(true); setRunning(false); refresh() }}/>
                    </div>)}</div><div className={styles.legend}><span>green = pc</span><span>gold = operand address</span><span>values are decimal</span></div>
                </section>
                <section><div className={styles.sectionTitle}>last instructions</div><div className={styles.trace}>{trace.length ? trace.map(t => <div key={t.cycle}><span>{t.cycle.toString().padStart(3)} · {hex(t.pc)}</span><span>{decode(t.inst)}</span><span>{t.write ? `m[${t.write.address}] ← ${t.write.value}` : `a ${t.a} → ${t.nextA}`}</span></div>) : <p>press step to execute the first instruction.</p>}</div></section>
                <section><div className={styles.sectionTitle}>what you are looking at</div><p>{mode === 'manual' ? 'each horizontal accumulator lane is one bit. the two muxes choose load/subtract, then hold/write. the separate six-lane counter chooses pc + 1 or the jump address.' : 'your Verilog, synthesized by Yosys. ELK chooses the placement order; the grid router connects each net, reserving space for explicit crossovers.'}</p><p>only AND, NAND, OR, NOR, XOR, XNOR, MUX, NOT and DFF do computation. Cross only routes signals. memory is the sole high-level interface.</p></section>
            </aside>
        </div>
    </main>
}
