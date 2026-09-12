import { Coord, coord } from "./coord";
import { Gate, Wire } from "../components/gates";
import { Circuit } from "./circuit";

function ccw(A: Coord, B: Coord, C: Coord) {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
}

function intersect(A: Coord, B: Coord, C: Coord, D: Coord) {
    return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
}

export function gateIntersectsGate(g1Coords: Coord, g1Size: Coord, g2Coords: Coord, g2Size: Coord): boolean {
    return g1Coords.x < g2Coords.x + g2Size.x && g1Coords.x + g1Size.x > g2Coords.x &&
           g1Coords.y < g2Coords.y + g2Size.y && g1Coords.y + g1Size.y > g2Coords.y;
}

export function wireIntersectsGate(w: Wire, gCoords: Coord, gSize: Coord): boolean {
    const gx1 = gCoords.x;
    const gy1 = gCoords.y;
    const gx2 = gCoords.x + gSize.x;
    const gy2 = gCoords.y + gSize.y;

    for (let i = 0; i < w.path.length - 1; i++) {
        const A = w.path[i];
        const B = w.path[i+1];

        if (A.x > gx1 && A.x < gx2 && A.y > gy1 && A.y < gy2) return true;
        if (B.x > gx1 && B.x < gx2 && B.y > gy1 && B.y < gy2) return true;

        if (A.x === B.x && (A.x === gx1 || A.x === gx2)) {
            const minY = Math.min(A.y, B.y);
            const maxY = Math.max(A.y, B.y);
            if (Math.max(gy1, minY) < Math.min(gy2, maxY)) return true;
        }
        if (A.y === B.y && (A.y === gy1 || A.y === gy2)) {
            const minX = Math.min(A.x, B.x);
            const maxX = Math.max(A.x, B.x);
            if (Math.max(gx1, minX) < Math.min(gx2, maxX)) return true;
        }

        const C1 = coord([gx1, gy1]);
        const C2 = coord([gx2, gy1]);
        const C3 = coord([gx2, gy2]);
        const C4 = coord([gx1, gy2]);

        if (intersect(A, B, C1, C2)) return true;
        if (intersect(A, B, C2, C3)) return true;
        if (intersect(A, B, C3, C4)) return true;
        if (intersect(A, B, C4, C1)) return true;
    }
    return false;
}

export function isValidPlacement(circuit: Circuit, item: Gate | Wire, itemCoords?: Coord, ignoreGateIdx?: number): boolean {
    itemCoords = itemCoords || coord([0,0]);
    if (item instanceof Gate) {
        for (let i = 0; i < circuit.gates.length; i++) {
            if (i === ignoreGateIdx) continue;
            if (gateIntersectsGate(itemCoords, item.size, circuit.gates[i].coords, circuit.gates[i].item.size)) return false;
        }
        for (const w of circuit.wires) {
            if (wireIntersectsGate(w.item, itemCoords, item.size)) return false;
        }
    } else if (item instanceof Wire) {
        for (const g of circuit.gates) {
            if (wireIntersectsGate(item, g.coords, g.item.size)) return false;
        }
    }
    return true;
}
