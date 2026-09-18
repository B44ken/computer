## how does electricity make a rock think?

we know a computer has a processor and memory. that is a useful answer until you ask what either of those things actually does. let’s build a small one, far enough down that every arithmetic operation has a wire you can follow.

a silicon chip is not literally thinking because current passes through a stone. the useful trick is that a carefully built device lets **one electrical signal control another electrical connection**. repeat that trick, organize the connections, and we get logic. add memory and we can carry out sequences of operations. the words “instruction” and “program” come much later.

## two electrical ideas first

**voltage** is an electrical potential difference between two points. **current** is moving charge. voltage does not flow from source to drain; current can flow when there is a conducting path and a voltage difference across it. we will call the reference rail ground, or 0 V, and the positive supply VDD. ground is a reference and return connection, not a drain into which electricity disappears.

a bit is an interpretation of a signal: a sufficiently low voltage means 0, and a sufficiently high voltage means 1. actual circuits have valid voltage ranges, noise margins, and transition times. the gap between those valid ranges is not a useful third bit value. we will initially ignore those analog details, but not pretend that disconnected means zero.

## a field controls a channel

silicon is a semiconductor. adding small amounts of other atoms changes the available charge carriers; those deliberately modified regions help form a transistor. in a MOS field-effect transistor, an insulated **gate** creates an electric field that changes the conductivity of a channel between **source** and **drain**. the gate is not a pipe through which the source-to-drain current must pass.

a real MOSFET also has a body terminal. our logic diagrams leave it implicit, with the usual body connections to the supply rails. we are treating the device as a controlled switch, not solving semiconductor physics or transistor current equations.

for an enhancement-mode **n-channel** device, a sufficiently positive gate-to-source voltage turns the channel on. a **p-channel** device conducts with a sufficiently negative gate-to-source voltage. with the usual n-side near ground and p-side near VDD, the useful shorthand is “n on for high input; p on for low input.” p-channel does not mean “normally on regardless of source voltage.”

@@transistors

## from switches to a reliable answer

start with **n switch** in the explorer. on connects the output to ground. off disconnects it: the output is floating. then try **p switch**: on connects the output to VDD, while off leaves it floating. neither alone gives us a complete two-valued logic output for every input.

combine one p-channel pull-up with one n-channel pull-down, both controlled by the same input. low input connects the output high; high input connects it low. that is **NOT**, also called an inverter. we deliberately arrange complementary paths so the settled output connects to one rail, not both. connecting both supply rails would be a short; connecting neither leaves no defined output in this model.

for **NAND**, put the two n-channel switches in series. the pull-down path only exists when both inputs are high. put the two p-channel switches in parallel: either low input creates a pull-up path. so the output is zero only for 11. for **NOR**, exchange series and parallel: either high input creates a pull-down path, while both inputs must be low for pull-up. an **OR** is that NOR followed by an inverter.

## your first experiment

select nand and visit all four input combinations. before each change, predict which supply the output will connect to. the explorer marks the combinations you have visited. do not memorize a cartoon symbol yet: trace the conducting path.

the colored paths show ideal connectivity, not electrons moving at an illustrated speed. this model omits resistance, capacitance, leakage, threshold losses and switching transients. a floating node is shown as **Z**, rather than quietly converted to 0. that is the boundary between this switch experiment and the two-valued gate simulator we will use next.
