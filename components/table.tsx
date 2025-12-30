import { useEffect, useState } from 'react'
import { Button, Gate, Lightbulb, NANDGate, NOTGate, Wire } from '../components/gates'
import { Components } from './comps'

export const SVGGate = ({ gate = new Gate(), coords = [0, 0], scale, origin, onClick }) => {
    const [hover, setHover] = useState(false)
    const [x, y] = coords
    const svg = gate.svgFull({ width: gate.size[0] * scale, height: gate.size[1] * scale }, hover)
    return <g
        transform={`translate(${(x - origin[0]) * scale}, ${(y - origin[1]) * scale})`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={onClick}
    >
        {svg}
    </g>
}
export const SVGWire = ({ wire = new Wire([]), scale, origin }) => {
    const points = wire.path.map(([x, y]) => `${(x - origin[0]) * scale},${(y - origin[1]) * scale}`).join(' ')
    return <polyline points={points} fill="none" stroke="black" strokeWidth={4} />
}

export default () => {
    const scale = 24, origin: [number, number] = [0, 5]
    const W = scale * 24, H = scale * 16

    const [comps, setComps] = useState(() => {
        const c = new Components()
        c.addAt(new Button(), [1, 6])
        c.addAt(new Wire([[3, 7], [7, 7]]), [0, 0])
        c.addAt(new NOTGate(), [7, 6])
        c.addAt(new Wire([[9, 7], [10, 7]]), [0, 0])
        
        c.addAt(new Button(), [4, 8])
        c.addAt(new Wire([[6, 9], [10, 9]]), [0, 0])
        
        c.addAt(new NANDGate(), [10, 6])
        c.addAt(new Lightbulb(), [13, 7])
        c.addAt(new Wire([[12, 8], [13, 8]]), [0, 0])
        return c
    })

    useEffect(() => {
        const interval = setInterval(() => {
            comps.update()
            const newComps = new Components()
            comps.gates.forEach(g => newComps.addAt(g.item, g.coords))
            comps.wires.forEach(w => newComps.addAt(w.item, w.coords))
            setComps(newComps)
        }, 100)
        return () => clearInterval(interval)
    }, [comps])

    const handleClick = () => {
        comps.update()
        const newComps = new Components()
        comps.gates.forEach(g => newComps.addAt(g.item, g.coords))
        comps.wires.forEach(w => newComps.addAt(w.item, w.coords))
        setComps(newComps)
    }

    return <svg width={W} height={H} className='border-2 m-2' viewBox={`0 0 ${W} ${H}`}>
        {comps.wires.map((obj, i) => <SVGWire key={i} wire={obj.item} scale={scale} coords={obj.coords} origin={origin} />)}
        {comps.gates.map((obj, i) => <SVGGate key={i} gate={obj.item} scale={scale} coords={obj.coords} origin={origin} onClick={() => { obj.item.click(); handleClick() }} />)}
    </svg>
}