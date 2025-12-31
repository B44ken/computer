import { Coord } from "../../../lib/coord"
import { Gate } from "./Gate"

export type Pin = { type: 'in' | 'out', voltage?: boolean, invert?: boolean, coord: Coord }
export type Pinout = Record<string, Pin>
export type PinDecl = Record<string, { type: 'in' | 'out', coord: Coord | [number, number], invert?: boolean }>
export type GateViewProps = { gate: Gate, width: number, height: number, hover: boolean }