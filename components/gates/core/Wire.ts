import { Coord, coord } from "../../../lib/coord"

export class Wire {
    public path: Coord[]
    constructor(path: Coord[] | [number, number][] = []) {
        this.path = path.map(coord)
        for (let i = 2; i < this.path.length;) {
            const a = this.path[i - 2], b = this.path[i - 1], c = this.path[i]
            if ((a.x == b.x && b.x == c.x) || (a.y == b.y && b.y == c.y)) this.path.splice(i - 1, 1)
            else i++
        }
    }
}
