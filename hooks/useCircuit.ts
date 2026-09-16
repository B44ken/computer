import { useState, useEffect, useCallback, useRef, SetStateAction } from 'react'
import { Circuit } from '../lib/circuit'
import { Coord } from '../lib/coord'

export const useCircuit = (initialCircuit: Circuit | (() => Circuit), animate = true) => {
    const [circuit, setState] = useState<Circuit>(initialCircuit)
    const circuitRef = useRef(circuit)
    const setCircuit = useCallback((value: SetStateAction<Circuit>) => {
        circuitRef.current = typeof value === 'function' ? value(circuitRef.current) : value
        setState(circuitRef.current)
    }, [])
    const interact = useCallback(() => {
        circuitRef.current.update()
        setCircuit(circuitRef.current.clone())
    }, [setCircuit])
    useEffect(() => {
        if (!animate) return
        const raf = requestAnimationFrame(interact)
        return () => cancelAnimationFrame(raf)
    })
    const updateGate = useCallback((id: number, pos: Coord) => {
        circuitRef.current.gates[id].coords = pos
        circuitRef.current.invalidate()
        interact()
    }, [interact])
    const getCircuit = useCallback(() => circuitRef.current, [])
    return { circuit, interact, setCircuit, updateGate, getCircuit }
}
