## a combinational circuit has no yesterday

a settled adder output is determined by its current inputs. remove yesterday’s inputs and yesterday’s answer is gone. to accumulate a total or remember which instruction comes next, something must retain a state between computations.

feedback can provide that persistence. two cross-coupled NOR gates can settle into either of two complementary states. one output feeds the other gate’s input, and vice versa. once settled, each output helps maintain the other. this is not an acyclic combinational network anymore.

## first, a latch

in the set/reset latch below, set=1 forces q high; reset=1 forces it low. returning both control inputs to zero leaves the selected state in place. **do not assert set and reset together.** both outputs would be forced low, and releasing them together does not provide a uniquely defined next state. the lab starts with a deliberate reset so the initial state is known.

@@lab:latch

raise set, lower set, and notice q stays high. raise reset, lower reset, and notice q stays low. pressing the same input twice was not pointless: it separated “give the command” from “remove the command and remember.” this ideal simulation does not model analog metastability or how long a real latch needs to settle.

## then, an edge-triggered flip-flop

a data latch can be transparent while enabled. that is not what we want for a feedback datapath: if new data immediately changes the state that computes new data again, the machine can run around the loop uncontrolled.

a positive-edge **D flip-flop** solves the timing problem at our abstraction level. it captures its D input on a low-to-high clock transition and presents that captured bit at Q. changing D while the clock merely stays high does not recapture it. implementations can use two latches with opposite transparency phases; we will use the existing one-bit DFF primitive rather than depend on zero-delay gate timing to imitate a physical clock circuit.

@@lab:dff

make d=1 with clk=0. q should remain unchanged. raise clk and q becomes 1. change d back to zero while clk stays high: q is still 1. lower clk, then raise it again to capture zero. **pulse clock** performs one low→high→low sequence.

## a register is several of these

four DFFs sharing a clock store four bits. each D input can come from a mux: select new data to load, or select Q to retain the old value. an unchanged value does not require freezing the entire machine’s clock.

@@lab:register

load 1010, turn load off, change all input bits, and pulse again. the stored output must remain 1010. then turn load on and capture the new word. each stored bit is a separate DFF you can inspect or remove.

real synchronous hardware also needs setup and hold times: D must be stable around the capture edge. the native simulator instead settles the combinational network, samples all sequential inputs, then commits all state outputs together. it does not let the first updated flip-flop feed a “new” value into another flip-flop sampling the same edge.

initial zeros in these exercises are a simulator power-on convention. ordinary ASIC flip-flops are not guaranteed to power up to zero just because a Verilog variable has an initializer. a physical implementation needs an appropriate initialization or reset strategy.
