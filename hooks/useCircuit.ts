import { useState, useEffect, useCallback, useRef } from 'react'
import { Circuit } from '../lib/circuit'
import { Coord } from '../lib/coord'

export const useCircuit = (initialCircuit: Circuit | (() => Circuit)) => {
    const [circuit, setCircuit] = useState<Circuit>(initialCircuit)
    const circuitRef = useRef(circuit)

    useEffect(() => {
        circuitRef.current = circuit
    }, [circuit])

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            circuitRef.current.update()
            setCircuit(circuitRef.current.clone())
        })
        return () => cancelAnimationFrame(raf)
    })

    const interact = useCallback(() => {
        circuitRef.current.update()
        setCircuit(circuitRef.current.clone())
    }, [])

    const updateGate = useCallback((id: number, pos: Coord) => {
        circuitRef.current.gates[id].coords = pos
        setCircuit(circuitRef.current.clone())
    }, [])

    return { circuit, interact, setCircuit, updateGate }
}
