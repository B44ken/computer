export class Coord {
    constructor(public x: number, public y: number) { }
    eq(c: Coord) { return this.x == c.x && this.y == c.y }
    add(c: Coord) { return new Coord(this.x + c.x, this.y + c.y) }
    sub(c: Coord) { return new Coord(this.x - c.x, this.y - c.y) }
    mul(s: number) { return new Coord(this.x * s, this.y * s) }
    div(s: number) { return new Coord(this.x / s, this.y / s) }
    round() { return new Coord(Math.round(this.x), Math.round(this.y)) }
    snap(s: number = 1) { return this.div(s).round().mul(s) }
    toString() { return `(${this.x}, ${this.y})` }
}


export const coord = (a: [number, number] | Coord) => a instanceof Coord ? a : new Coord(a[0], a[1])

export function isPointOnSegment(p: Coord, a: Coord, b: Coord): boolean {
    const crossProduct = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y)
    if (Math.abs(crossProduct) > Number.EPSILON) return false

    const dotProduct = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)
    if (dotProduct < 0) return false

    const squaredLength = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)
    if (dotProduct > squaredLength) return false

    return true
}