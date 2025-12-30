import { Gate, Wire } from "./gates";

type ComponentItem<T> = { item: T, coords: [number, number] }
type Connection = { from: Gate, to: Gate, fromPin: string, toPin: string, via: Wire }

export class Components {
    gates: ComponentItem<Gate>[] = []
    wires: ComponentItem<Wire>[] = []
    connections: Connection[] = []
    addAt(c: Gate | Wire, coord: [number, number]) {
        if (c instanceof Gate) {
            this.gates.push({ item: c, coords: coord })
        } else if (c instanceof Wire) {
            this.wires.push({ item: c, coords: coord })
        } else console.warn("tried to add", c)

        this.connections = null
    }

    buildConnections(): Connection[] {
        let conns: Connection[] = []
        for (const w of this.wires) {
            let [begin, end] = [w.item.path[0], w.item.path[w.item.path.length - 1]]
            let beginGood, endGood
            for (const g of this.gates) {
                for (const p in g.item.pins) {
                    let pin = g.item.pins[p], pos = g.coords
                    let abs = [pin.coord[0] + pos[0], pin.coord[1] + pos[1]]
                    if (abs[0] == begin[0] && abs[1] == begin[1]) beginGood = [g.item, p]
                    if (abs[0] == end[0] && abs[1] == end[1]) endGood = [g.item, p]
                }
            }
            if (beginGood?.[0]?.pins[beginGood[1]]?.type == 'output' && endGood?.[0]?.pins[endGood[1]]?.type == 'input')
                conns.push({ from: beginGood[0], to: endGood[0], fromPin: beginGood[1], toPin: endGood[1], via: w.item })
            else if (endGood?.[0]?.pins[endGood[1]]?.type == 'output' && beginGood?.[0]?.pins[beginGood[1]]?.type == 'input')
                conns.push({ from: endGood[0], to: beginGood[0], fromPin: endGood[1], toPin: beginGood[1], via: w.item })
        }
        return conns
    }

    update(maxIterations = 20) {
        if(!this.connections) this.connections = this.buildConnections()
        let stable = false
        for (let i = 0; i < maxIterations; i++) {
            stable = true

            for (const { from, to, fromPin, toPin } of this.connections)
                stable = !to.set(toPin, from.get(fromPin)) && stable

            for (const { item } of this.gates)
                stable = !item.update() && stable
        }
    }
}