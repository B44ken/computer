# gate-level computer

target: `verilog/stupid.v` at `7fe16903be3f00841749b9444b5b14fac7f46f67` (not the older tiny-tapeout cpu).

open `/computer` in the existing next app, or build the standalone offline viewer:

```sh
node --test test/gate-computer.test.mjs
node tools/build-computer.mjs
open build/gate-computer/gate-computer.html
```

no npm dependencies are needed for these commands. the build emits both routed circuit json files, full-resolution svg schematics, scalar-gate verilog, memory verilog, five assembly/hex programs, cycle traces, and a geometry report. generated artifacts live in `build/gate-computer/`; they are reproducible and are not checked in.

## what was built

| variant | cpu gates | dffs included | routing grid | crossovers | routed length |
|---|---:|---:|---:|---:|---:|
| hand-built teaching layout | 88 | 14 | 216 × 244 | 489 | 9,857 |
| automatic placement + routing | 101 | 14 | 172 × 158 | 847 | 10,670 |

lengths and dimensions are schematic grid units, not silicon dimensions. the automatic layout occupies 48.4% less bounding-box area. it trades more crossovers and wire length for the smaller footprint; this is not a claim of globally optimal packing.

the cpu contains only individual AND, NAND, OR, NOR, XOR, XNOR, MUX, NOT, and DFF primitives. there are no register, counter, subtractor, decoder, or cpu-macro cells. every state bit and every carry gate is exposed. colored regions and labels are annotations, not components. the only higher-level component is a shared 64 × 8 memory interface. the clock symbol is a stimulus terminal.

the teaching variant's logic and bit-slice positions are hand specified; its shared wiring is still obstacle-routed. it is **not** claimed to be individually hand-routed. the automatic variant starts from a separately lowered full-adder network, then anneals placement using net bounding-box wire cost. it does not parse or claim to reproduce the exact checked-in `out-stupid.v` cell graph; both variants implement the behavior of `stupid.v`.

## follow an instruction

`inst[7:6]` selects one of four operations. `inst[5:0]` is the six-bit memory address or branch target.

| bits | assembly | rising-edge operation |
|---|---|---|
| 00 | `lda address` | accumulator ← memory[address] |
| 01 | `sta address` | memory[address] ← accumulator |
| 10 | `sub address` | accumulator ← accumulator − memory[address], modulo 256 |
| 11 | `jz address` | pc ← address when accumulator is zero; otherwise pc + 1 |

pc increments modulo 64 for every non-taken branch and every other instruction. store and jump preserve the accumulator. there is no reset input, enable input, carry flag, immediate instruction, or halt instruction. the fourteen DFFs power up at zero, matching the initial values in the source. “assemble + restart” is a simulator power cycle, not an extra hardware reset circuit.

start at the six program-counter DFFs. their outputs address the instruction read port. the returned byte both selects an operation and addresses the data read port. a row of the subtractor forms `A + ~M + 1`; the carry enters the next row. the teaching carry mux chooses the incoming carry when the two adder inputs differ, and chooses A when they agree. the accumulator's next two muxes choose load/subtract and then update/hold. eight DFFs store those results. the OR/NOR tree detects zero, and two AND gates enable the branch muxes only for opcode 11 and zero A.

step clock to see a whole instruction. click a gate or wire to trace one scalar net. scroll to zoom; drag to pan. the program-counter and subtractor buttons frame those parts. the memory grid highlights the next instruction and the most recent write. double-click a byte to edit it. switching layouts restarts the currently selected source program; it does not transplant partly executed state.

## memory and clock semantics

`stupid_memory` has one 64-byte storage array, two asynchronous read ports (instruction at pc; operand at instruction address), and one rising-edge write port. code and data really share storage, so self-modifying code works. an instruction reading an address it just modified on the preceding edge sees the new byte.

before a rising edge, settle the memory reads and combinational primitive network. sample every DFF input and the RAM write address/data/enable from that same pre-edge state. then commit all writes together and settle again. stepping is not a sequential in-place update of registers. this avoids the race caused by using the editor's original repeated `Gate.update()` loop as a clock scheduler.

the browser is an ideal synchronous, zero-delay simulation; it does not certify physical setup/hold timing, propagation delay, fanout, electrical loading, or a fabricated SRAM implementation. the behavioral memory module is an explicit permitted abstraction.

## routing and crossover handling

gates are obstacles, with protected pin escapes and reserved annotation space. the router connects all sinks of a net to its existing tree, reusing shared trunks. A* permits an unrelated net to cross only a straight perpendicular track. it cannot turn at that crossing, merge with the other net, or pass through a gate. failed passes are ripped up and rerun with the blocked nets prioritized; incomplete routes are never exported as successful.

`Cross.tsx` reuses the tutorial branch's two independent channels: TL → BR and TR → BL. the large viewer uses the same path and channel mapping, rotated to align with orthogonal tracks. each crossing is oriented so its two input pins face the actual upstream drivers; it is not silently treated as a bidirectional gate. a small diamond marks the crossover; a filled dot marks an actual junction. route segments are cut at crossover ports. crossover records are routing objects, not extra logic gates.

validation rebuilds a graph from segment coordinates, splitting each crossover into independent horizontal and vertical vertices. it checks that every pin has exactly the intended driver, that all branches are connected, and that there are no shorts, floating wires, duplicate edges, non-Manhattan edges, cell overlaps, or wires through cells. deleting a crossover must fail the tests with a short; reversing one or changing its channel mapping must also fail. export json includes these explicit crossings rather than just drawing intersecting polylines.

## tests and programs

both primitive networks are checked for all 256 accumulator values × all 256 memory values × all four opcodes: 524,288 one-step cases total. a separate sweep covers every pc and branch target with zero, each individual set accumulator bit, and 255. sixty random unified-memory programs per variant run for 128 cycles each, comparing registers and the entire memory after every cycle against a separate behavioral model.

the supplied programs test load/store, subtraction underflow, a countdown loop, 6 × 7 = 42, eight fibonacci iterations (21, 34), and replacement of an instruction in memory. `.org`, `.byte`, decimal/hex numbers, signed byte constants, comments, and labels are supported. address overlap, overflow, unresolved labels, invalid operands, and unknown opcodes are rejected. examples end in a zero-accumulator `jz` self-loop; the viewer may pause on that loop, but the hardware has not halted.

run actual HDL differential simulation after installing Icarus Verilog:

```sh
node tools/build-computer.mjs
iverilog -g2012 -s tb -o build/gate-computer/test.vvp \
  verilog/stupid.v verilog/memory.v build/gate-computer/gates.v \
  test/gate-computer-tb.v
for f in build/gate-computer/program-*.hex; do
  vvp build/gate-computer/test.vvp +program="$f" +cycles=256
done
```

the testbench runs the original behavioral cpu and both generated gate CPUs on independent RAMs and compares bus signals, registers, and all 64 memory bytes around each edge. `.github/workflows/gate-computer.yml` runs the node tests and this HDL testbench, then publishes the build artifacts.

## integration

the existing small circuit-editor pages and their update semantics are untouched. `/computer` embeds a self-contained, dependency-free viewer because the old geometric net builder and update loop are not an appropriate synchronous CPU simulator. the new shared modules implement the flat primitive netlist, simulator, placement/router, rendering, and assembler; the tests and browser use the same implementations. `components/gates/Cross.tsx` is also available to the original editor. the standalone viewer is usable without next or a server.
