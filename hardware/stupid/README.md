# stupid, in the existing logic simulator

`npm install && npm run dev`, then open `/computer`. Choose **hand-built** or
**autorouted**, load a program, and step or run. The gates are editable with the
same **Toolbox**, **CircuitBoard**, **SVGGate**, **SVGWire**, and **useCircuit** as
`/free` and the adder pages. Fit/zoom and quarter-turn rotation are available in
the shared editor. **Reset** resets state; **restore wiring** reloads the layout
and undoes circuit edits.

## execution path

`lib/computer/load.ts` translates the generated layout into ordinary objects:

```ts
const circuit = new Circuit()
circuit.add(new NANDGate('nand.0'), [x, y])
circuit.add(new Cross('cross.0'), [x, y], rotation)
circuit.add(new Wire(points))
// ...and one MemoryGate
circuit.buildConnections()
circuit.tick()
```

There is **no separate GateComputer runtime or Board renderer**. Loading never
assigns `circuit.connections` or injects net-ID connections. `Circuit` builds its
own connectivity from its actual `Wire` paths and placed gate pins. The normal
`Gate.update()` implementations propagate signals. The compiler's logical net
labels are used for audits, not for execution. Moving a gate or deleting a wire
breaks its actual connection: an integration test removes bit zero's D wire and
checks that `LDA 9` produces 8, not 9.

The CPU uses only AND, NAND, OR, NOR, XOR, XNOR, MUX, NOT and one-bit DFFs.
There is no hidden ALU, adder, subtractor, decoder, multi-bit register or
instruction interpreter driving it. The assembler/disassembler in the panel is
instrumentation; the independent instruction interpreter is in tests only.

The existing combinational gate definitions and `Cross.tsx` are unchanged.
Cross instances retain their original **1×1 square, view, and corner pins**.
Quarter-turn rotation is a property of the placed instance, not a mutation of
its definition. Short perimeter leads reach the corner pins without crossing
the internal diagonal conductors. The shared placement checker permits these
boundary leads on Cross, but not wires through its interior. Every crossing on
the generated board uses an actual Cross device; the route audit rejects bare
crossings between different nets. The editor's existing vertex-junction
convention remains intact for older schematics.

## memory and clock

One visible **MemoryGate** contains a shared 64-byte code/data array, with all
37 pins actually wired to the CPU. Its two reads are asynchronous:

- `inst = bytes[out_pc]`
- `in_mem = bytes[out_adr]`

It writes `bytes[out_adr] = out_mem` on a step when `we` is high. The CPU's
`out_adr` is wired directly from the instruction's low six bits; memory does
not decode the opcode or implement CPU state. Its contents are also editable
in the side panel.

There are exactly 14 CPU state bits: eight accumulator DFFs and six PC DFFs,
initially zero. They use the simulator's **implicit global clock**. DFFs expose
D and Q; there is no disconnected pretend clock pin. Initialization is a
simulator feature, not a physical ASIC power-on-reset circuit.

`Circuit.tick()` is shared by all pages. It settles, calls every gate's
`sample()`, then every gate's `commit()`, then settles again. Thus DFFs and
memory capture the old inputs before any state changes. The shared core has no
CPU-specific instruction cases. The editor exposes tick/reset controls for
ordinary circuits containing DFFs too.

The shared simulator now settles until stable rather than stopping after 20
passes, and uses a spatial index to build connectivity. Button now toggles on
click, rather than toggling during evaluation. A native half-adder regression
and a two-DFF pipeline test check these shared changes.

## the two layouts

| measured result | hand-built | autorouted |
|---|---:|---:|
| CPU primitives, including DFFs | 81 | 116 |
| individual DFFs | 14 | 14 |
| original Cross instances | 408 | 502 |
| bounding box in gate units | 171 × 131 | 149 × 131 |
| wire length in gate units | 7391 | 7544.5 |
| physical memory components | 1 | 1 |
| geometry/connectivity audit errors | 0 | 0 |

Footprints include actual memory, wiring and labels. These are compact routed
layouts, not claims of optimality or physical PCB manufacturability.

**Hand-built:** `lib/computer/manual.ts` independently constructs the primitive
gate network and places eight accumulator bit slices, the zero detector, and
the six-bit PC increment/jump path. The wires around that placement are routed
automatically; this is not a claim that each wire is hand-routed. Use the
accumulator/counter/bit-slice view buttons to follow the datapath.

Each accumulator slice forms `a XOR m`, then XORs with borrow-in. When input
bits differ, borrow-out is m; otherwise it is borrow-in. A MUX implements that
rule. The two other muxes select load/subtract and hold/write before the DFF.
The zero detector is an OR tree ending in NOR. The PC has a ripple incrementer
and muxes selecting increment or jump address.

**Autorouted:** the uploaded `stupid.v` is unchanged. Yosys produces a restricted
primitive netlist; ELK seeds placement and deterministic swaps reduce net span
in a compact array. An obstacle-aware half-grid router grows multi-sink nets
as trees and inserts explicit Cross instances. All cell and pin dimensions
come from the actual gate constructors. The memory body is also an obstacle.

The checked-in netlist uses Yosys 0.33. The supplied 0.69 netlist is separately
preserved and tested. Other synthesis versions may change counts/layouts.

## ISA and programs

An instruction is `[opcode:2][address:6]`:

| opcode | operation | effect |
|---|---|---|
| 00 | LDA x | a = memory[x] |
| 01 | STA x | memory[x] = a |
| 10 | SUB x | a = a − memory[x], modulo 256 |
| 11 | JZ x | pc = x when a is zero |

Otherwise PC increments modulo 64. Store and branch preserve a. There is no
HALT opcode: programs park in `halt: JZ halt` with a zero accumulator. The run
button recognizes that label, but stepping still executes the real branch.

Six selectable assembly programs and hex images cover 9−4, countdown,
addition using a negated temporary, 6×7, 0−1 wrapping to 255, and rewriting a
future instruction. See `programs/`; the source is `lib/computer/programs.ts`.

## reproduce the checks

```sh
npm run test:computer        # native Circuit, all gates, routed boards, edits
npm run test:rtl             # Python 3 + Icarus; original RTL + uploaded netlist
npm run build               # production Next.js build
npm run test:browser         # Playwright + Chromium; starts real Next.js server
npm run layout:computer      # regenerate both layouts from checked-in netlist
npm run build:computer       # also regenerate netlist; requires Yosys
npm run assemble -- hardware/stupid/programs/subtract.asm /tmp/subtract.hex
```

The 16 tests include all 65,536 subtraction pairs for each logical network,
every instruction byte at every PC with five accumulator boundary values, all
six programs checked at each edge, and 4,096 random-memory cycles per **native
routed Circuit**. Additional tests verify exact class/view/pin identity, wire
removal and gate movement changing execution, simultaneous DFF sampling,
Button click behavior, legacy half-adder behavior, and geometry/short audits.
The RTL tests cover 38 memory images and 4,996 edges, comparing all registers
and every memory byte.

The browser test normally starts a production Next.js server and visits
`/computer`, `/free`, and `/halfadder` over HTTP. It runs all six programs on
both layouts, deletes an actual CPU DFF using Erase and observes the wrong
arithmetic result, restores wiring, and places/wires/toggles/erases a circuit
in the original free editor. It also checks mobile overflow and screenshots.
`BROWSER_BASE_URL` selects an existing server; `CHROMIUM` selects a browser.
`BROWSER_OFFLINE=1` is an optional local DOM harness for environments without
browser networking; CI uses real Next.js HTTP. Artifacts go in
`.test-artifacts/browser/` or `BROWSER_OUTPUT`.
