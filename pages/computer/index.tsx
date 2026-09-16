import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { GateComputer, Step } from '../../lib/computer/machine'
import { Layout } from '../../lib/computer/model'
import { assemble, decode, programs } from '../../lib/computer/programs'
import { technology } from '../../lib/computer/parts'
import styles from './computer.module.css'

const hex = (n: number) => n.toString(16).padStart(2, '0')
type View = { x: number, y: number, w: number, h: number }

function Board({ machine, revision }: { machine: GateComputer, revision: number }) {
    const layout = machine.layout, ref = useRef<SVGSVGElement>(null)
    const [view, setView] = useState<View>({ x: 0, y: 0, w: layout.width, h: layout.height })
    const [selected, select] = useState<string | null>(null), [net, setNet] = useState<string | null>(null)
    const drag = useRef<{ x: number, y: number, active: boolean } | null>(null)
    const fit = () => setView({ x: 0, y: 0, w: layout.width, h: layout.height })
    useEffect(() => { fit(); select(null); setNet(null) }, [machine]) // eslint-disable-line react-hooks/exhaustive-deps
    const zoom = (factor: number) => setView(v => ({ x: v.x + v.w * (1 - factor) / 2, y: v.y + v.h * (1 - factor) / 2, w: v.w * factor, h: v.h * factor }))
    useEffect(() => {
        const svg = ref.current!
        const wheel = (e: WheelEvent) => {
            e.preventDefault()
            const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
            const f = e.deltaY < 0 ? 0.85 : 1 / 0.85
            setView(v => v.w * f < 8 || v.w * f > 2000 ? v : ({ x: point.x + (v.x - point.x) * f, y: point.y + (v.y - point.y) * f, w: v.w * f, h: v.h * f }))
        }
        svg.addEventListener('wheel', wheel, { passive: false })
        return () => svg.removeEventListener('wheel', wheel)
    }, [])
    const focus = (section: string) => {
        if (section === 'bit slice') {
            const origin = layout.cells.find(c => c.id === 'pair.0')!
            return setView({ x: origin.x - 10, y: origin.y - 9, w: 68, h: 38 })
        }
        const re = section === 'accumulator' ? /^(a\.|pair\.|diff\.|borrow\.|not.a|load.sub|hold)/ : section === 'counter' ? /^(pc\.|increment|carry)/ : /^(not.op|store|is.jump|take.jump)/
        const cells = layout.cells.filter(c => re.test(c.id))
        if (!cells.length) return fit()
        const x = Math.min(...cells.map(c => c.x)) - 8, y = Math.min(...cells.map(c => c.y)) - 6
        setView({ x, y, w: Math.max(...cells.map(c => c.x + technology[c.kind].width)) - x + 8,
            h: Math.max(...cells.map(c => c.y + technology[c.kind].height)) - y + 6 })
    }
    const selectedGate = selected ? machine.parts.get(selected) : undefined
    const located = [...layout.cells, ...layout.bridges.map(b => ({ id: b.id, x: b.center[0] - 0.5, y: b.center[1] - 0.5 }))]
    const uniqueTerminals = layout.terminals.filter((t, i, all) => !all.slice(0, i).some(a => a.x === t.x && a.y === t.y))
    return <div className={styles.board}>
        <div className={styles.boardTools}>
            <button onClick={fit}>fit</button><button aria-label="zoom in" onClick={() => zoom(0.75)}>+</button><button aria-label="zoom out" onClick={() => zoom(4 / 3)}>−</button>
            {layout.spec.name === 'hand-built' && <><button onClick={() => focus('bit slice')}>bit slice</button><button onClick={() => focus('accumulator')}>accumulator</button><button onClick={() => focus('counter')}>counter</button><button onClick={() => focus('decode')}>decode</button></>}
            <span>scroll to zoom · drag to pan · click a wire or gate</span>
        </div>
        <svg ref={ref} data-testid="gate-board" data-revision={revision} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className={styles.svg}
            onPointerDown={e => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, active: false } }}
            onPointerMove={e => {
                if (!drag.current) return
                if (!drag.current.active && Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) < 3) return
                ref.current!.setPointerCapture(e.pointerId)
                const m = ref.current!.getScreenCTM()!, dx = (e.clientX - drag.current.x) / m.a, dy = (e.clientY - drag.current.y) / m.d
                setView(v => ({ ...v, x: v.x - dx, y: v.y - dy })); drag.current = { x: e.clientX, y: e.clientY, active: true }
            }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
            <defs><pattern id="grid" width={1} height={1} patternUnits="userSpaceOnUse"><circle cx={0} cy={0} r={0.035} fill="#26313a"/></pattern></defs>
            <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#grid)" onClick={() => { select(null); setNet(null) }}/>
            {layout.notes.map((n, i) => <text key={i} x={n.x} y={n.y} fontSize={0.85} fill="#b6c6d2" fontFamily="monospace">{n.text}</text>)}
            {layout.traces.map((trace, i) => {
                const driver = machine.wireDrivers[i], high = driver.gate.get(driver.pin)
                return <polyline key={i} points={trace.points.map(p => p.join(',')).join(' ')} fill="none"
                    stroke={net === trace.net ? '#f5d778' : high ? '#75d9ac' : '#50616c'} strokeWidth={net === trace.net ? 0.22 : 0.12}
                    opacity={net && net !== trace.net ? 0.24 : 1} strokeLinejoin="round" className={styles.wire}
                    onClick={e => { e.stopPropagation(); setNet(trace.net); select(null) }}>
                    <title>{trace.net}: {high ? 1 : 0}</title>
                </polyline>
            })}
            {located.map(c => {
                const g = machine.parts.get(c.id)!, cross = c.id.startsWith('cross.')
                return <g key={c.id} data-gate={c.id} transform={`translate(${c.x},${c.y})`} onClick={e => { e.stopPropagation(); select(c.id); setNet(null) }}>
                    {cross && <rect width={1} height={1} rx={0.12} fill="#111820" stroke={selected === c.id ? '#f5d778' : '#3b4b58'} strokeWidth={0.065}/>}
                    <g.view gate={g} width={g.size.x} height={g.size.y} hover={selected === c.id}/>
                    <title>{c.id} · {cross ? 'Cross: two isolated signal paths' : layout.cells.find(x => x.id === c.id)?.kind}</title>
                </g>
            })}
            {uniqueTerminals.map(t => {
                const alias = layout.terminals.filter(p => p.x === t.x && p.y === t.y).map(p => p.id).join(' / ')
                const label = t.id.replace('in_mem', 'm').replace('out_mem', 'a → m').replace('out_pc', 'pc → m').replace('inst', 'inst')
                return <g key={t.id} onClick={() => { setNet(t.net); select('memory') }}>
                    <circle cx={t.x} cy={t.y} r={0.2} fill={machine.memory.get(t.id) ? '#75d9ac' : '#111820'} stroke="#adbed0" strokeWidth={0.08}/>
                    <text x={t.x} y={t.y - 0.6} textAnchor="middle" fontSize={0.65} fill="#d3dfe8">{label}</text><title>{alias}</title>
                </g>
            })}
        </svg>
        <div className={styles.inspector}>
            {selectedGate ? <><strong>{selectedGate.name === 'memory' ? 'memory interface' : selectedGate.name}</strong><span>{Object.entries(selectedGate.pins).filter(([p]) => p !== 'C').map(([p, v]) => `${p}=${Number(Boolean(v.voltage))}`).join('  ')}</span></>
                : net ? <><strong>net {net}</strong><span>highlighted end to end, including its Cross fragments</span></>
                : <><strong>the wires are the circuit.</strong><span>one layer · explicit Cross devices · all 14 dffs share the step clock</span></>}
        </div>
    </div>
}

export default function ComputerPage() {
    const [mode, setMode] = useState<'manual' | 'auto'>('manual'), [programId, setProgramId] = useState(programs[0].id)
    const [source, setSource] = useState(programs[0].source.trim()), [assembly, setAssembly] = useState(() => assemble(programs[0].source))
    const [machine, setMachine] = useState<GateComputer | null>(null), [error, setError] = useState('')
    const [revision, setRevision] = useState(0), [running, setRunning] = useState(false), [rate, setRate] = useState(4), [trace, setTrace] = useState<Step[]>([])
    const [custom, setCustom] = useState(false)
    const machineRef = useRef(machine); machineRef.current = machine
    const program = programs.find(p => p.id === programId)!
    useEffect(() => {
        let cancelled = false; setRunning(false); setMachine(null); setError('')
        fetch(`/computer/${mode}.json`).then(r => { if (!r.ok) throw Error('could not load circuit'); return r.json() }).then((layout: Layout) => {
            if (cancelled) return
            const m = new GateComputer(layout); m.reset(assembly.image); setMachine(m); setTrace([]); setRevision(n => n + 1)
        }).catch(e => { if (!cancelled) setError(String(e.message)) })
        return () => { cancelled = true }
    }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps
    const refresh = () => setRevision(n => n + 1)
    const step = useCallback(() => {
        const m = machineRef.current
        if (!m) return
        const result = m.step(); setTrace(t => [...t.slice(-11), result]); setRevision(n => n + 1)
    }, [])
    useEffect(() => {
        if (!running || !machine) return
        const timer = setInterval(() => {
            if (machine.snapshot().pc === assembly.labels.halt && machine.snapshot().a === 0) { setRunning(false); return }
            try { step() } catch (e) { setError(String(e)); setRunning(false) }
        }, 1000 / rate)
        return () => clearInterval(timer)
    }, [running, machine, rate, assembly, step])
    useEffect(() => {
        const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); step() } }
        window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
    }, [step])
    const load = (text: string, isCustom: boolean) => {
        try {
            const a = assemble(text); machine?.reset(a.image); setAssembly(a); setTrace([]); setRunning(false); setError(''); setCustom(isCustom); refresh()
        } catch (e) { setError(String((e as Error).message)) }
    }
    const snapshot = machine?.snapshot(), parked = snapshot?.pc === assembly.labels.halt && snapshot?.a === 0
    const correct = machine && Object.entries(program.expected).every(([a, v]) => machine.memory.bytes[Number(a)] === v)
    return <main className={styles.page}>
        <header className={styles.header}>
            <div><Link href="/" className={styles.back}>← logic bench</Link><h1>stupid<span> / a computer, made of gates</span></h1></div>
            <div className={styles.tabs}><button aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>hand-built</button><button aria-pressed={mode === 'auto'} onClick={() => setMode('auto')}>autorouted</button></div>
        </header>
        <div className={styles.toolbar}>
            <button disabled={!machine} className={styles.primary} onClick={step}>step <kbd>space</kbd></button>
            <button disabled={!machine} onClick={() => setRunning(!running)}>{running ? 'pause' : 'run'}</button>
            <select aria-label="clock rate" value={rate} onChange={e => setRate(Number(e.target.value))}><option value={1}>1 hz</option><option value={4}>4 hz</option><option value={20}>20 hz</option><option value={100}>100 hz</option></select>
            <button disabled={!machine} onClick={() => { machine?.reset(assembly.image); setTrace([]); setRunning(false); refresh() }}>reset</button>
            <div className={styles.metrics}>{machine ? `${machine.layout.cells.length} primitives · ${machine.flipflops.length} dffs · ${machine.layout.bridges.length} Cross · ${machine.layout.width} × ${machine.layout.height} units` : 'loading circuit…'}</div>
        </div>
        {error && <div role="alert" className={styles.error}>{error}</div>}
        <div className={styles.body}>
            {machine ? <Board machine={machine} revision={revision}/> : <div className={styles.loading}>loading the gate-level layout…</div>}
            <aside className={styles.panel}>
                <section><div className={styles.sectionTitle}>on the wires <span>cycle {machine?.cycles || 0}</span></div>
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
                        <label htmlFor={`mem-${i}`}>{i}</label><input id={`mem-${i}`} aria-label={`memory ${i}`} title={`${i}: ${machine ? decode(machine.memory.bytes[i]) : ''}`} type="number" min={0} max={255}
                            key={`${i}-${machine?.memory.bytes[i]}`} defaultValue={machine?.memory.bytes[i] || 0}
                            onBlur={e => { const n = Number(e.target.value); if (!machine || !Number.isInteger(n) || n < 0 || n > 255) { e.target.value = String(machine?.memory.bytes[i] || 0); return }; if (machine.memory.bytes[i] === n) return; machine.memory.bytes[i] = n; machine.settle(); setCustom(true); setRunning(false); refresh() }}/>
                    </div>)}</div><div className={styles.legend}><span>green = pc</span><span>gold = operand address</span><span>values are decimal</span></div>
                </section>
                <section><div className={styles.sectionTitle}>last instructions</div><div className={styles.trace}>{trace.length ? trace.map(t => <div key={t.cycle}><span>{t.cycle.toString().padStart(3)} · {hex(t.pc)}</span><span>{decode(t.inst)}</span><span>{t.write ? `m[${t.write.address}] ← ${t.write.value}` : `a ${t.a} → ${t.nextA}`}</span></div>) : <p>press step to execute the first instruction.</p>}</div></section>
                <section><div className={styles.sectionTitle}>what you are looking at</div><p>{mode === 'manual' ? 'each horizontal accumulator lane is one bit. the two muxes choose load/subtract, then hold/write. the separate six-lane counter chooses pc + 1 or the jump address.' : 'your Verilog, synthesized by Yosys. ELK chooses the placement order; the grid router connects each net, reserving space for explicit crossovers.'}</p><p>only AND, NAND, OR, NOR, XOR, XNOR, MUX, NOT and DFF do computation. Cross only routes signals. memory is the sole high-level interface.</p></section>
            </aside>
        </div>
    </main>
}
