import fs from 'node:fs'
import { fromYosys } from '../lib/computer/yosys'
import { manualComputer } from '../lib/computer/manual'
import { autoPlace } from '../lib/computer/place'
import { route } from '../lib/computer/route'
import { loadComputer, snapshot } from '../lib/computer/load'
import { audit } from '../lib/computer/audit'
import { programs, assemble } from '../lib/computer/programs'

async function main() {
    fs.mkdirSync('hardware/stupid/programs', { recursive: true })
    for (const p of programs) {
        const stem = `hardware/stupid/programs/${p.id}`
        fs.writeFileSync(stem + '.asm', p.source.trim() + '\n')
        fs.writeFileSync(stem + '.hex', Array.from(assemble(p.source).image, n => n.toString(16).padStart(2, '0')).join('\n') + '\n')
    }
    const spec = fromYosys(JSON.parse(fs.readFileSync('hardware/stupid/gates.json', 'utf8')))
    for (const mode of ['manual', 'auto']) {
        const placed = mode === 'manual' ? manualComputer() : await autoPlace(spec)
        console.log(mode, 'placed', Math.max(...placed.cells.map(c => c.x)), Math.max(...placed.cells.map(c => c.y)))
        console.time(mode)
        let layout: ReturnType<typeof route> | undefined
        const priority: string[] = []
        for (let attempt = 0; attempt < 16; attempt++) {
            try { layout = route(placed, 14, priority); break }
            catch (e) {
                const failed = /unroutable (\S+) to/.exec(String(e))?.[1]
                if (!failed) throw e
                const old = priority.indexOf(failed); if (old >= 0) priority.splice(old, 1)
                priority.unshift(failed)
                console.log(mode, 'reroute', attempt + 1, String(e))
            }
        }
        if (!layout) throw Error('routing attempts exhausted')
        const metrics = audit(layout)
        const { circuit, memory } = loadComputer(layout)
        for (const p of programs) {
            const program = assemble(p.source); memory.load(program.image); circuit.reset()
            let count = 0
            while (!(snapshot(memory).pc === program.labels.halt && snapshot(memory).a === 0) && count++ < 500) circuit.tick()
            if (count >= 500) throw Error(`${mode}/${p.id} did not finish`)
            for (const [addr, value] of Object.entries(p.expected)) if (memory.bytes[Number(addr)] !== value) throw Error(`${mode}/${p.id} bad memory[${addr}]`)
            console.log(mode, p.id, 'passed', count)
        }
        fs.mkdirSync('public/computer', { recursive: true })
        fs.writeFileSync(`public/computer/${mode}.json`, JSON.stringify(layout))
        fs.writeFileSync(`public/computer/${mode}.metrics.json`, JSON.stringify(metrics, null, 2) + '\n')
        console.timeEnd(mode)
        console.log(mode, layout.cells.length, 'gates', layout.bridges.length, 'crossovers', layout.width, 'x', layout.height)
    }
}
main().catch(e => { console.error(e); process.exit(1) })
