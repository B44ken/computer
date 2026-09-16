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
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy
    if (length2 === 0) return p.sub(a).len() < 1e-8
    if (Math.abs((p.y - a.y) * dx - (p.x - a.x) * dy) > 1e-8 * Math.sqrt(length2)) return false
    const dot = (p.x - a.x) * dx + (p.y - a.y) * dy
    return dot >= -1e-8 && dot <= length2 + 1e-8
}
