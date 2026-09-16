import fs from 'node:fs'
import { assemble } from '../lib/computer/programs'
const [input, output] = process.argv.slice(2)
if (!input || !output) throw Error('usage: npm run assemble -- program.asm image.hex')
const { image } = assemble(fs.readFileSync(input, 'utf8'))
fs.writeFileSync(output, Array.from(image, n => n.toString(16).padStart(2, '0')).join('\n') + '\n')
