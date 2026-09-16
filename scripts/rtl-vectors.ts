import fs from 'node:fs'
import { assemble, programs } from '../lib/computer/programs'
const dir = process.argv[2]
fs.mkdirSync(dir, { recursive: true })
const cases: { id: string, image: number[], cycles: number }[] = programs.map(p => ({ id: p.id, image: Array.from(assemble(p.source).image), cycles: 150 }))
let seed = 192837
const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0 }
for (let i = 0; i < 32; i++) cases.push({ id: `random-${i}`, image: Array.from({ length: 64 }, () => rand() & 255), cycles: 128 })
for (const c of cases) fs.writeFileSync(`${dir}/${c.id}.hex`, c.image.map(v => v.toString(16).padStart(2, '0')).join('\n') + '\n')
fs.writeFileSync(`${dir}/cases.json`, JSON.stringify(cases))
