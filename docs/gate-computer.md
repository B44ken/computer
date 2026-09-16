# computer in the existing simulator

`/computer` is a native React page using `CircuitBoard`, `Toolbox`, and `useCircuit`. Every component is an instance of the repository's `Gate` classes, and every drawn wire is a `Wire` consumed by `Circuit.buildConnections()`. There is no iframe, second simulator, SVG replacement renderer, or instruction interpreter in the application. The rejected `public/gate-computer` implementation has been removed.

## run

```sh
npm install
npm run dev
# open /computer

npm run test:computer
npm run export:computer
```

The tests take a few minutes: the exhaustive cases really propagate through the gate instances and routed Cross components, not an accelerated behavioral CPU. The existing half-adder/adder/editor pages use the same simulator and renderer.

## the computer

This implements `verilog/stupid.v`: eight accumulator DFFs, six program-counter DFFs, and a shared 64-byte address space. The high two instruction bits select load, store, subtract, or jump-if-zero; the lower six select the address. Arithmetic wraps to eight bits; the pc wraps to six. Store/jump preserve the accumulator. The DFFs initialize to zero, matching the source. There is no extra reset pin, carry flag, or hardware halt.

Only AND/NAND/OR/NOR/XOR/XNOR/NOT/MUX/DFF primitives implement the CPU. The unchanged combinational gate classes supply their existing truth functions, shapes, and pin layouts. MUX and DFF follow the same Gate interface and are also available in the toolbox. Cross is the tutorial branch's TL→BR / TR→BL component. Button supplies the external clock. Memory is the only permitted higher-level component.

`Memory` has two asynchronous read ports and one rising-edge write port on the **same** 64-byte array. Code is writable. Its pin voltages, not CPU software state, select addresses and write values. `verilog/memory.v` implements the matching interface.

## two layouts

| layout | CPU primitives (including 14 DFFs) | Cross instances | board units |
|---|---:|---:|---:|
| hand-built | 88 | 757 | 160 × 166 |
| automatic | 101 | 1,142 | 166 × 136 |

The teaching layout has hand-specified bit slices, fixed functional regions, and 40 explicitly routed local connections. The remaining shared/feedback wires use the router. It is not presented as a fully hand-routed design. The automatic layout anneals the primitive positions before routing; neither layout is claimed to be globally minimal. The automatic footprint is approximately 15% smaller.

Crosses are real Gate instances. They are rotated and displayed at 0.45 scale to fit single-unit routing tracks. `Gate.pinPosition()` and `SVGGate` apply the **same** transform, including that scale, so the wire endpoints land on the real pins. Their Boolean transfer happens in `Cross.update()`, not in the router or an alternative evaluator. At unmarked intersections, the simulator retains its original rule: intersecting wire interiors alone do not join. Routed CPU intersections are explicitly broken into Cross channels, and branches share real Wire endpoints.

The builder's descriptions and annotations are construction data only. After construction the simulator has no use for opcode descriptions or logical net identifiers; it executes Gate.update() and its geometric connections. Changing a gate's behavior or cutting a Wire changes execution.

## simulation changes

`Circuit.buildConnections()` uses a spatial segment index to preserve the editor's geometric endpoint-junction rules without an all-pairs scan. It diagnoses multiple drivers. Unconnected inputs still settle to false, as before.

`Circuit.update()` settles combinational gates through the existing `Gate.update()` methods, samples every sequential component, commits the sampled changes together, and settles again. DFF and Memory use the small `sample()`/`commit()` hooks. Thus a store and every DFF sample the same pre-edge state, regardless of clock route length. Repeated updates at a high clock do not produce extra edges. This is ideal synchronous simulation, not propagation-delay or electrical timing signoff.

The existing board gains pin inspection, pan/zoom/fit, live Wire voltages, and transformed Gate rendering. `useCircuit` can disable continuous animation for the large CPU while preserving the default behavior of the earlier pages. Moving or deleting components invalidates geometric connections. Exported JSON is a native `Circuit` serialization, with gate types, transformed positions, pins, memory bytes, and Wire paths. `deserializeCircuit()` restores it into the same simulator.

## programs and checks

The five programs exercise load/store and underflow, a countdown, 6 × 7 = 42, eight Fibonacci iterations yielding 21 and 34, and self-modifying code. They end in a zero-accumulator jump loop; the viewer may pause on that loop without inventing a halt instruction.

The test suite includes all 256 accumulator values × 256 memory values × four opcodes in **both** routed circuits, every pc/branch-target pair, complete-program and randomized cycle-by-cycle memory comparisons, simultaneous DFF sampling, serialization round trips, and regression tests for the original AND/XOR half-adder and wire geometry. Mutation tests cut a real Wire, reverse a real Cross, and alter a real XORGate truth function.

`validateComputer()` reconstructs drivers from `Circuit.buildConnections()`, follows actual Cross pin pairs, and checks each CPU/memory input against its intended driver. It also checks transformed component polygons and Wire segments for overlap/intersection with gate interiors. Both shipped layouts have zero open inputs, shorts, floating wires, gate overlaps, or wires through gate bodies.

The export script generates `gates.v` from the **actual Circuit connections**, including every Cross transfer. The HDL testbench compares these two routed gate CPUs with the unchanged original `stupid.v` and independent memories:

```sh
npm run export:computer
iverilog -g2012 -s tb -o build/gate-computer/test.vvp \
  verilog/stupid.v verilog/memory.v build/gate-computer/gates.v test/gate-computer-tb.v
for f in build/gate-computer/program-*.hex; do
  vvp build/gate-computer/test.vvp +program="$f" +cycles=256
done
```

The workflow runs the native tests, the Next build/type check, this HDL comparison, and publishes the generated Circuit JSON, Verilog, program images, traces, and validation counts.
