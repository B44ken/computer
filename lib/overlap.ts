import { Coord, coord } from "./coord";
import { Gate, Wire } from "../components/gates";
import { Circuit } from "./circuit";
import { Cross } from "../components/gates/Cross";
import { placedSize } from "./placement";

export function gateIntersectsGate(g1Coords: Coord, g1Size: Coord, g2Coords: Coord, g2Size: Coord): boolean {
    return g1Coords.x < g2Coords.x + g2Size.x && g1Coords.x + g1Size.x > g2Coords.x &&
           g1Coords.y < g2Coords.y + g2Size.y && g1Coords.y + g1Size.y > g2Coords.y;
}

export function wireIntersectsGate(w: Wire, gCoords: Coord, gSize: Coord, allowBoundary = false): boolean {
    const gx1 = gCoords.x;
    const gy1 = gCoords.y;
    const gx2 = gCoords.x + gSize.x;
    const gy2 = gCoords.y + gSize.y;

    for (let i = 0; i < w.path.length - 1; i++) {
        const A = w.path[i];
        const B = w.path[i+1];

        if (A.x > gx1 && A.x < gx2 && A.y > gy1 && A.y < gy2) return true;
        if (B.x > gx1 && B.x < gx2 && B.y > gy1 && B.y < gy2) return true;

        if (!allowBoundary && A.x === B.x && (A.x === gx1 || A.x === gx2)) {
            const minY = Math.min(A.y, B.y);
            const maxY = Math.max(A.y, B.y);
            if (Math.max(gy1, minY) < Math.min(gy2, maxY)) return true;
        }
        if (!allowBoundary && A.y === B.y && (A.y === gy1 || A.y === gy2)) {
            const minX = Math.min(A.x, B.x);
            const maxX = Math.max(A.x, B.x);
            if (Math.max(gx1, minX) < Math.min(gx2, maxX)) return true;
        }

        let lo = 0, hi = 1
        for (const [a, b, min, max] of [[A.x, B.x, gx1, gx2], [A.y, B.y, gy1, gy2]]) {
            if (a === b) { if (a <= min || a >= max) { lo = 1; hi = 0; break } }
            else { const t1 = (min - a) / (b - a), t2 = (max - a) / (b - a); lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)) }
        }
        if (lo < hi) return true
    }
    return false;
}

export function isValidPlacement(circuit: Circuit, item: Gate | Wire, itemCoords?: Coord, ignoreGateIdx?: number, rotation = 0): boolean {
    itemCoords = itemCoords || coord([0,0]);
    if (item instanceof Gate) {
        for (let i = 0; i < circuit.gates.length; i++) {
            if (i === ignoreGateIdx) continue;
            if (gateIntersectsGate(itemCoords, placedSize(item, rotation), circuit.gates[i].coords, placedSize(circuit.gates[i].item, circuit.gates[i].rotation))) return false;
        }
        for (const w of circuit.wires) {
            if (wireIntersectsGate(w.item, itemCoords, placedSize(item, rotation), item instanceof Cross)) return false;
        }
    } else if (item instanceof Wire) {
        for (const g of circuit.gates) {
            if (wireIntersectsGate(item, g.coords, placedSize(g.item, g.rotation), g.item instanceof Cross)) return false;
        }
    }
    return true;
}
