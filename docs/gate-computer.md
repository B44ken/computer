# computer built in the native logic simulator

`/computer` uses the repository's `CircuitBoard`, `Toolbox`, `Circuit`, `Gate`, and `Wire`. there is no iframe, standalone simulator, alternate gate renderer, or CPU interpreter. the rejected `public/gate-computer` implementation has been removed.

```sh
npm install
npm run dev
# open /computer

npm run test:computer
npm run build:computer
```

the existing half-adder, adder, four-bit-adder, and free editor pages still use the same shared circuit classes and board.

## the actual components

all seven original combinational gate files are unchanged, as are `Button` and `Lightbulb`. `Cross.tsx` is copied byte-for-byte from the user's tutorial branch, with TL → BR and TR → BL. the constructor rotates its pin coordinates where required, but every crossover remains a real, full-size 1 × 1 `Cross` instance. its `update()` method participates in simulation, including along the clock distribution paths.

added primitives are a one-bit `MUXGate` and a one-bit rising-edge `DFF`. the only higher-level functional component is `Memory`, a shared 64-byte array with two asynchronous read ports and one rising-edge write port. the clock is the existing `Button` stimulus. there are no register, counter, decoder, subtractor, or CPU macro components.

`lib/computer/netlist.ts` is only a construction recipe. `buildComputer()` instantiates the native gate classes, places them, and creates native `Wire` polylines. after construction, execution calls **only `Circuit.update()`**. the displayed accumulator and pc are read from the fourteen actual DFF output pins. changing or deleting a wire changes execution; its original logical label cannot secretly keep the connection alive.

## two layouts

both layouts use the same 88 primitive gates, including fourteen DFFs, one memory component, and one original Button. extra Cross instances are counted separately.

| layout | occupied bounds, native units | full-size crosses | native wires |
|---|---:|---:|---:|
| teaching | 166.5 × 187.5 | 678 | 1,899 |
| automatic | 157.5 × 169.5 | 836 | 2,212 |

the bounds include the actual wire geometry and components, not empty routing-canvas padding. the automatic layout occupies about 14.5% less area; it uses more wire and crossovers. these are reproducible layouts, not a claim of global optimality.

the teaching layout has explicitly arranged bit slices: invert memory data, ripple subtraction, load selection, hold selection, and accumulator DFFs. the lower bank contains increment gates, jump muxes, and the six pc DFFs. a separate OR/NOR tree detects zero. these region labels are annotations only. **the logic and teaching placement are hand specified; the shared wiring still uses the router. this is not a fully hand-routed schematic.**

the automatic variant anneals placement against net wire-length cost before routing. A* routes around the native footprints, reuses same-net trunks, and inserts Cross components wherever independent tracks must cross. no fake tiny crossing icons or logical connections bypass the actual components. original gates retain their original dimensions and views.

## clocking in Circuit

`Circuit.buildConnections()` still derives connectivity from native wire paths and gate pin coordinates. its original endpoint-on-polyline rule is preserved; spatial buckets replace the all-pairs search. pins that touch wires participate in those physical nets. multiple drivers are reported, and unconnected inputs go low as in the original simulator.

`Circuit.update()` evaluates the actual gates and propagates values through those extracted connections. once all combinational paths settle, it calls `sample()` on every gate, then `commit()` on every gate. combinational gates inherit no-op implementations. DFF and Memory implement them. this makes a shared rising edge simultaneous: every DFF and RAM write reads the old state before any of them commits. it also prevents a long chain of real Cross cells on the clock from making later flip-flops sample already-updated state.

this remains an ideal synchronous logic simulator, not a model of propagation delay, analog loading, metastability, or setup/hold timing. no hardware reset input or halt instruction has been added; restart reinitializes the simulator just as the original verilog initializes A and pc to zero.

## instructions and programs

this implements `verilog/stupid.v`, not the earlier tiny-tapeout CPU. each byte contains a two-bit opcode and a six-bit address:

| opcode | assembly | action on the rising edge |
|---|---|---|
| 00 | `lda addr` | A ← memory[addr] |
| 01 | `sta addr` | memory[addr] ← A; A unchanged |
| 10 | `sub addr` | A ← A − memory[addr], modulo 256 |
| 11 | `jz addr` | jump when A = 0; A unchanged |

pc otherwise increments modulo 64. code and data share the same memory, so stores can modify future instructions. there are no immediate operands, carry flags, or hidden microcode.

the assembler supports labels, comments, `.org`, `.byte`, decimal/hex numbers and signed byte constants. supplied programs cover load/store and underflow, countdown, 6 × 7 = 42, fibonacci ending in 21 and 34, and self-modifying code. they park in a zero-accumulator JZ self-loop; the run control may pause there, but hardware has not halted.

## use and edit

step clock or run the program; the clock is also a clickable native Button on the board. click a gate, pin, or wire to trace the actual connected paths through Cross cells. use fit, scroll to zoom, drag the background to pan, or focus the subtractor and pc. the existing toolbox can place, move, wire, and erase real components. wire mode joins two snapped points with an orthogonal bend. double-click a memory byte to edit it. switching layout reconstructs the original circuit and restarts the source program.

“check wiring” verifies the CPU's original intended pin connections against the edited native geometry. an intentional modification may therefore execute differently and fail that check. JSON export contains the real circuit's gate types, placements, pin coordinates/values, wire paths, and RAM image.

## verification and exports

`test/native-computer.test.ts` runs on the real imported gate classes and Circuit. it checks original primitive truth tables, simultaneous DFF capture, fifty actual Cross stages in a clock path, all five programs on each layout, 6,144 randomized program cycles, full RAM comparison after every instruction, native connectivity, and geometric clearance. a destructive test removes the actual wire feeding accumulator bit 1: LDA 42 produces 40; replacing the wire restores 42.

`validateGeometry()` checks the final native wire segments, including all crossover leads, against every actual component body. it rejects unintended wire intersections. `validateNative()` resolves each intended input through the simulator's extracted connections and the real Cross channel directions; it rejects opens, shorts, incorrect drivers, and overlapping gates. nothing is validated solely against a separate simulated netlist.

`npm run build:computer` emits native SVGs (using `SVGGate` / `SVGWire` and each component's actual view), circuit JSONs, programs, traces, metrics, memory verilog, and `computer.v`. that verilog is exported from **Circuit's geometry-extracted nets**, not the construction recipe. its Cross instances become isolated wire assignments; all CPU logic is scalar primitives.

```sh
iverilog -g2012 -s tb -o build/native-computer/test.vvp \
  verilog/stupid.v verilog/memory.v \
  build/native-computer/computer.v test/native-tb.v
for f in build/native-computer/program-*.hex; do
  vvp build/native-computer/test.vvp +program="$f" +cycles=256
done
```

the HDL testbench compares both wire-extracted native circuits and independent RAMs with the unchanged original verilog around every edge. the workflow also builds the Next app and runs `test/native-browser.mjs` against its real `/computer` route, tests program execution and editing, checks the older editor pages, and saves browser screenshots alongside the generated artifacts.
