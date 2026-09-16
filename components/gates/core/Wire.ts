import { Coord, coord, isPointOnSegment } from "../../../lib/coord"

export class Wire {
    public path: Coord[]
    voltage = false
    constructor(path: Coord[] | [number, number][] = []) {
        this.path = path.map(coord).filter((p, i, all) => !i || !p.eq(all[i - 1]))
        for (let i = 2; i < this.path.length;) {
            const a = this.path[i - 2], b = this.path[i - 1], c = this.path[i]
            if (isPointOnSegment(b, a, c)) this.path.splice(i - 1, 1)
            else i++
        }
    }
    has(p: Coord) {
        for (let i = 0; i < this.path.length - 1; i++)
            if (isPointOnSegment(p, this.path[i], this.path[i + 1])) return true
        return false
    }
}
