import { JSX } from "react"

type Pin = {
    type: 'input' | 'output' | 'either'
    voltage?: boolean
    coord: [number, number]
}
type Pinout = Record<string, Pin>

export class Gate {
    constructor(public size: [number, number] = [1, 1], public pins: Pinout = {}) { }
    get(pin: string): boolean | undefined { return this.pins[pin]?.voltage }
    set(pin: string, value: boolean): boolean {
        // return true if voltage changed
        const diff = this.pins[pin]?.voltage != value
        this.pins[pin].voltage = value
        return diff
    }
    update() { return false } // default no-op
    click(ts?: Gate) { }
    svg(props: any, hover: boolean = false): JSX.Element {
        return <g>
            <rect {...props} fill={hover ? "#555" : "#000"} stroke="#9ca3af" rx="4" />
        </g>
    }
    svgFull(props: any, hover: boolean = false): JSX.Element {
        return <>
            {this.svg(props, hover)}
            {Object.entries(this.pins).map(([key, { coord, voltage }]) =>
                <circle key={key} cx={coord[0] * props.width / this.size[0]} cy={coord[1] * props.height / this.size[1]} r={4} fill={voltage ? "#7e7" : "#000"} stroke="#000" />
            )}
        </>
    }
}

export class NOTGate extends Gate {
    constructor() {
        super([2, 2], { 'Y': { 'type': 'output', 'coord': [2, 1] }, 'A': { 'type': 'input', 'coord': [0, 1] } })
    }

    update() { return this.set('Y', !this.get('A')) }

    svg({ height, width }: { height: number, width: number }, hover: boolean = false): JSX.Element {
        return <path d={`M0 0 L${width} ${height / 2} L0 ${height} Z`} fill={hover ? '#444' : '#000'} />
    }
}


export class NANDGate extends Gate {
    constructor() {
        super([2, 4], {
            'Y': { 'type': 'output', 'coord': [2, 2] },
            'A': { 'type': 'input', 'coord': [0, 1] },
            'B': { 'type': 'input', 'coord': [0, 3] }
        })
    }

    update() { return this.set('Y', !(this.get('A') && this.get('B'))) }
    svg({ height, width }): JSX.Element {
        return <path d={`
            M0 0
            L${width * 0.6} 0
            Q ${width} 0, ${width} ${width * 0.4}
            L${width} ${height * 0.8}
            Q ${width} ${height}, ${width * 0.6} ${height}
            L0 ${height}
            Z
        `} fill="#000" stroke="#9ca3af" />
    }
}

export class Wire {
    constructor(public path: number[][] = []) { }
}

export class Button extends Gate {
    constructor() {
        super([2, 2], { 'Y': { 'type': 'output', 'coord': [2, 1] } })
    }

    svg(props, hover: boolean = false) {
        return <rect {...props} fill={hover ? "#555" : '#000'} stroke="#9ca3af" rx="4" />
    }

    click() { this.set('Y', !this.get('Y')) }
}

export class Lightbulb extends Gate {
    constructor() {
        super([2, 2], { 'A': { 'type': 'input', 'coord': [0, 1] } })
    }

    svg(props, hover: boolean = false) {
        return <circle cx={props.width / 2} cy={props.height / 2} r={props.width / 2 - 2} fill={this.get('A') ? "#7e7" : "#222"} stroke="#9ca3af" />
    }
}