# how to build a computer

Start at `/learn` (also the home page). The thirteen chapters at
`/learn/[slug]` run from transistor switching through an executable
four-instruction computer. All chapters are open; progress is local to the
browser and requires no account. Existing workbench and adder routes remain.

## course architecture

`course/*.md` contains approximately 7,400 words of original lesson text.
`lib/course/lessons.ts` supplies navigation, objectives, references, twenty
activity checkpoints, and twenty-six questions with feedback and hints.
`@@lab:name`, `@@transistors`, and `@@programming` embed interactive activities.
The Markdown renderer escapes content; it does not execute arbitrary HTML.

There are **18 native circuit labs**. `lib/course/circuits.ts` constructs actual
`Circuit`, `Gate`, `Wire`, `Cross`, Button and Lightbulb objects. It reuses the
merged router and native geometry-based connectivity. `CircuitLab` renders
`CircuitBoard` and `Toolbox` and uses `useCircuit`. There is no second CPU
runtime, gate renderer, or net-ID execution engine.

Worked reference, missing-wire repair and unwired-parts modes use independent
serialized copies. Learner editing cannot mutate the reference. Checks run on
another copy, so grading does not consume the learner's register state. They
check geometry, opens/shorts, allowed primitives and functional test vectors.
Gate/RAM labs include arithmetic, feedback storage, selection, decoding, and a
2-word × 2-bit memory made from individual DFFs. The full computer is exactly
`buildComputer('manual')` from the merged main implementation, including its
physically connected clock and sole high-level 64-byte Memory interface.

Only the transistor chapter uses a separate, explicitly **switch-level**
model: connectivity of ideal n/p switches with low, high, floating and
contention states. It is not an analog device simulator. Source-relative gate
control, supply rails, insulated gates and model limits are explained before
using the digital abstraction. The course does not claim ASIC power-on reset,
analog timing accuracy, or manufacturing sign-off.

The final programming exercise assembles source and runs six independent
input images through the actual native gate computer. It checks doubling
modulo 256 at memory[60], with a zero-accumulator parking loop. It is not an
instruction emulator or hardcoded success button.

`lib/course/progress.ts` validates stored checkpoint data. Native circuit edits
and the assembly draft also persist in localStorage. A lesson is complete only
when its experiment/build checks and both questions pass. A worked reference
passing its own test does not earn the build checkpoint. Storage denial/quota
errors leave the lesson usable and show a message where progress/edits cannot
be saved.

## shared changes

The router's memory label is optional so small circuits can use it. The
Toolbox accepts optional allowed kinds and disabled keyboard shortcuts (several
labs can share a page). The existing CircuitBoard uses pointer events for mouse
and touch; it still connects the same native objects and supports inspect,
wire, erase and moving gates. No original combinational gate implementation
or simulator execution loop was replaced for this course. SVG pin titles use a
single string to preserve server/client rendering, and resizing callbacks stop
when a board unmounts. Truth-table inspection now evaluates a copy rather than
changing the live circuit’s input buttons; its displayed rows are also corrected.

## run and verify

```sh
npm install
npm run dev
# /learn
npm run test:course
npm run test:computer
npm run build -- --webpack
# install Python Playwright and its Chromium before the browser suite:
python3 -m pip install playwright==1.57.0
python3 -m playwright install --with-deps chromium
npm run test:course:browser
```

The browser suite starts **a production Next.js HTTP server**, visits all 13
chapters, checks every native lab using the real UI, repairs a wire with real
pointer actions, reloads saved edits/progress, checks edge-triggered state and
programming, exercises the original workbench/half-adder, and visits all mobile
chapters including a native touch interaction. Screenshots and a JSON report
are written to `.test-artifacts/course-browser`. Set `BROWSER_BASE_URL` to use
an already-running server, `CHROMIUM` for another executable, or
`BROWSER_OUTPUT` for another artifact directory. Nothing is mocked in this
browser test.

The 27-test unit suite checks lesson/marker consistency, grading/serialization,
transistor truth tables/floating/short behavior, actual wire failures and
repairs, allowed components, geometry, feedback/state and all six programming
images. Existing gate-computer CI continues its independent native and HDL
regressions. `course.yml` checks the course and produces browser evidence.

Lesson 13 describes Yosys synthesis and explicitly distinguishes it from this
repository's construction code: the merged automatic layout does not import
arbitrary Verilog at runtime. Original RTL is available under
`/course-source/stupid.v` as well as in `verilog/`.
