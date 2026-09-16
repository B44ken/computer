import { useState, useEffect, useCallback, useRef, SetStateAction } from 'react'
import { Circuit } from '../lib/circuit'
import { Coord } from '../lib/coord'
import { isValidPlacement } from '../lib/overlap'

export const useCircuit = (initialCircuit: Circuit | (() => Circuit)) => {
    const [circuit, setState] = useState<Circuit>(initialCircuit)
    const [revision, setRevision] = useState(0)
    const circuitRef = useRef(circuit)
    const setCircuit = useCallback((value: SetStateAction<Circuit>) => {
        const next = typeof value === 'function' ? value(circuitRef.current) : value
        circuitRef.current = next; setState(next)
    }, [])
    useEffect(() => {
        let frame: number
        const update = () => {
            if (circuit.update()) setRevision(n => n + 1)
            frame = requestAnimationFrame(update)
        }
        frame = requestAnimationFrame(update)
        return () => cancelAnimationFrame(frame)
    }, [circuit])
    const interact = useCallback(() => { circuitRef.current.update(); setRevision(n => n + 1) }, [])
    const updateGate = useCallback((id: number, pos: Coord) => {
        const current = circuitRef.current, g = current.gates[id]
        if (g && isValidPlacement(current, g.item, pos, id, g.rotation)) {
            g.coords = pos; current.invalidate(); interact()
        }
    }, [interact])
    return { circuit, revision, interact, setCircuit, updateGate }
}
