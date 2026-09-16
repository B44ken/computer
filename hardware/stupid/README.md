# stupid: a computer made of gates

Open `/computer` after `npm install && npm run dev`. The home page links there.
Choose **hand-built** or **autorouted**, select a program, and press **step**
(space) or **run**. Every visible CPU device is a one-bit primitive. Click a
wire to highlight its whole net; click a gate to inspect its pins. Scroll to
zoom, drag to pan, or use the hand-built section buttons.

## what is actually simulated

The CPU uses only AND, NAND, OR, NOR, XOR, XNOR, MUX, NOT and DFF. No ALU,
adder, comparator, multi-bit register, decoder or CPU instruction interpreter
is hidden inside a component. The hand-built subtractor, incrementer and
zero detector are made explicitly from those primitives.

Both boards use the repository's existing gate implementations and `Cross`.
`Cross` retains its independent TL→BR and TR→BL channels. A geometric
transformation puts its terminals on orthogonal half-grid tracks; the
router reserves a whole 1×1 footprint for it. Wires are cut at its terminals,
not silently drawn across each other. Same-net branches may join; different
nets never share a wire coordinate. This is an ideal logic layout, not a
manufacturable PCB or silicon layout.

The only higher-level interface is the 64×8 memory. It has one shared byte
array (code and data), two asynchronous reads and one clocked write:

- instruction = memory[pc]
- operand = memory[instruction & 63]
- on the edge, if we: memory[address] = accumulator

Its pins are distributed around the board, with the actual memory shown in
the side panel. `inst[5:0]` and `out_adr[5:0]` are direct aliases, not six
extra computation gates. Addresses are six bits; arithmetic wraps at eight
bits. Read access is an ideal combinational model with no wait states.

There are exactly **14 individual DFFs**, initially zero: eight accumulator
bits and six PC bits. They share the **implicit global step clock**, so the
clock tree is not routed. Initialization is a simulator feature, not an
ASIC power-on reset. Settling does not clock a DFF. A step does:

1. settle the actual routed circuit;
2. sample every DFF's D pin and the old memory-write pins;
3. write memory once and commit all DFFs together;
4. settle again.

`lib/computer/machine.ts` reconstructs connections from physical trace and
pin coordinates and runs the existing `Gate` objects, including the actual
Cross devices. It does **not** execute instructions in JavaScript. It checks
net labels for shorts but never uses them to connect disconnected geometry.
The independent instruction interpreter lives in the **tests only**.

## the two variants

| | hand-built | autorouted |
|---|---:|---:|
| CPU primitives, including DFFs | 81 | 116 |
| individual DFFs | 14 | 14 |
| explicit Cross devices | 169 | 397 |
| bounding box, gate units | 146 × 120 | 202 × 128 |
| wire length, gate units | 3763 | 7785.5 |

These are measured from the checked-in layouts, not a claim of optimality.
Gate bodies, pins and wires sit on a half-unit grid. The rectangular footprint
includes routing and labels, but not the separate memory editor.

**Hand-built:** `lib/computer/manual.ts` defines a different, independently
constructed gate network and deliberately places its bit slices and control
paths. The wire router connects that fixed placement. This is a hand-designed
datapath and placement, **not a claim that every wire was hand-routed**.

Each accumulator lane forms `a XOR m`, then XORs with borrow-in. For the
borrow chain, when the input bits differ, borrow-out equals m; otherwise it
equals borrow-in. A primitive MUX implements that choice. A second selection
chooses load versus subtract; another chooses hold versus write, before the
individual DFF. The six-bit PC incrementer and jump muxes sit to the right.
The zero detector is an OR tree ending in a NOR, not a stored flag.

**Autorouted:** the uploaded `stupid.v` is unchanged. Yosys maps it to the
allowed cells. `fromYosys` rejects unsupported cells, multiple clock domains,
unknown initialization and unresolved constants. ELK seeds the placement
order; deterministic swap annealing reduces net span in a compact array.
An obstacle-aware grid router then grows each multi-sink net as a tree,
inserting explicit crossovers when necessary. Pin escape routes are reserved
first; failed nets can be prioritized on a subsequent full routing pass.

The reference generated netlist uses Ubuntu 24.04's Yosys 0.33. Other Yosys
versions can produce different cells/counts and therefore different layouts.
The separately preserved `uploaded-netlist.v` is your supplied Yosys 0.69
output; the RTL tests compare it against your original RTL as well.

## instruction set

Every instruction is one byte: `[opcode:2][address:6]`.

| opcode | instruction | effect |
|---|---|---|
| 00 | LDA x | a = memory[x] |
| 01 | STA x | memory[x] = a |
| 10 | SUB x | a = a − memory[x], modulo 256 |
| 11 | JZ x | pc = x if a is zero |

Otherwise PC advances by one, modulo 64. Store and branch preserve a. There
is no HALT instruction: the examples finish with a zero accumulator and a
`halt: JZ halt` loop. The run button recognizes that assembler label; the
hardware itself keeps executing the branch when single-stepped.

The six runnable examples in `programs/` cover subtraction, countdown,
addition by negating a temporary, multiplication by repeated subtraction,
unsigned wraparound, and a store which rewrites a future instruction. The
`.hex` files contain all 64 bytes, one two-digit hexadecimal byte per line.
Their source of truth is `lib/computer/programs.ts`; layout generation also
exports these assembly and memory-image files.

## rebuild and verify

```sh
npm install
npm run test:computer        # checked-in gate netlists and routed geometry
npm run test:rtl             # requires Python 3 and Icarus Verilog
npm run build               # production Next.js build

# Recompile the CPU and regenerate both compact boards (requires Yosys):
npm run build:computer

# Assemble a program without opening the browser:
npm run assemble -- hardware/stupid/programs/subtract.asm /tmp/subtract.hex
```

`hardware/stupid/build.sh` performs `synth -noabc`, `dffunmap`, then a single
ABC mapping to the allowed combinational gates. NOT is implicitly available;
DFF is not part of ABC's combinational gate alphabet. The JSON preserves
initial states; the importer maps `$_DFF_P_` to a plain, globally clocked DFF.

Verification includes:

- all 65,536 subtraction input pairs for each gate network;
- every instruction byte at every PC, with five accumulator boundary values;
- all six programs, checking registers and every RAM byte at every edge;
- 4,096 random-memory instruction cycles per **physically routed** board;
- primitive and Cross truth tables, geometry/clearance/driver audits, and an
  intentionally shorted board which must be rejected;
- original RTL and uploaded Yosys netlist against an independent model using
  the real Verilog memory interface: 38 images, 4,996 clock edges;
- the real React page exercised in Chromium at desktop and mobile sizes,
  including all six programs on both boards, reset, stepping and the editor.

For the browser test, install Python Playwright and Chromium, then run
`npm run test:browser`. Set `CHROMIUM` to the browser executable as needed.
The harness bundles the **actual page** and serves only the two local layout
JSONs in memory; it does not require network navigation or a running server.
Screenshots and the result file go under `.test-artifacts/browser/` (override
with `BROWSER_OUTPUT`). `IVERILOG`, `VVP`, `IVL_PATH` and `YOSYS` can override
local tool paths. The normal app is still an ordinary Next.js `/computer`
page, and production compilation is tested separately.
