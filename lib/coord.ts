export class Coord {
    constructor(public x: number, public y: number) { }
    eq(c: Coord | [number, number]) { return this.x == coord(c).x && this.y == coord(c).y }
    add(c: Coord | [number, number]) { return new Coord(this.x + coord(c).x, this.y + coord(c).y) }
    sub(c: Coord | [number, number]) { return new Coord(this.x - coord(c).x, this.y - coord(c).y) }
    mul(s: number) { return new Coord(this.x * s, this.y * s) }
    div(s: number) { return new Coord(this.x / s, this.y / s) }
    round() { return new Coord(Math.round(this.x), Math.round(this.y)) }
    snap(s: number = 1) { return this.div(s).round().mul(s) }
    len() { return Math.sqrt(this.x * this.x + this.y * this.y) }
    toString() { return `(${this.x}, ${this.y})` }
}


export const coord = (a: [number, number] | Coord) => a instanceof Coord ? a : new Coord(a[0], a[1])

export function isPointOnSegment(p: Coord, a: Coord, b: Coord): boolean {
    if (a.eq(b)) return p.eq(a)
    const crossProduct = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y)
    if (Math.abs(crossProduct) > Number.EPSILON) return false

    const dotProduct = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)
    if (dotProduct < 0) return false

    const squaredLength = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)
    if (dotProduct > squaredLength) return false

    return true
}