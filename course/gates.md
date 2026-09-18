## put a boundary around a useful circuit

we could draw the transistors inside every nand gate for the rest of the course. instead, we give that little circuit a symbol and a contract: when its inputs are valid and have settled, its output is the opposite of their logical AND. a gate is an abstraction, not a different kind of electricity.

our native simulator uses the gate definitions already in this repository. the black shapes below are actual editable gate objects. the wires determine their connections. there is no hidden implementation that keeps the answer correct after you cut the drawing apart.

## a truth table is a complete small specification

for two input bits there are four combinations. writing down all four answers tells us everything about a two-input combinational function.

```text
a b | AND NAND OR NOR XOR XNOR
0 0 |  0   1   0   1   0   1
0 1 |  0   1   1   0   1   0
1 0 |  0   1   1   0   1   0
1 1 |  1   0   1   0   0   1
```

OR means at least one input; XOR means exactly one of two inputs. the small circle on a gate output denotes inversion. it does not add a separate clock or storage element.

## build an inverter

feed the same signal into both inputs of a nand. if that signal is 0, neither input is high, so the output is 1. if it is 1, both inputs are high, so the output is 0. `NAND(a,a)` is exactly `NOT a`.

@@lab:nand-not

## then an and gate

nand already gives us the complement of AND. invert its answer with the construction you just made. two nand gates now implement `a AND b`. the second nand takes the first gate’s output on both inputs; it does not require a second independent input signal.

@@lab:nand-and

## an or gate, without an or component

invert each input with its own nand. nand those inverted inputs together. for the only case in which OR should output zero, both original inputs are zero, so both inverted inputs are one, and the final nand outputs zero. for every other case at least one inverted input is zero and the result is one.

```text
a OR b = NOT ((NOT a) AND (NOT b))
```

this is one of de morgan’s laws. it tells us how to exchange series-like and parallel-like logical conditions by moving the inversions. more importantly, it shows that we can build these familiar functions with a single kind of primitive.

@@lab:nand-or

## how to use the editor

click input buttons, or use the labeled controls below a board. the lamps read the actual connected signals. **repair** removes a real wire. choose **Wire**, drag from the loose output toward the destination pin, and **check wiring**. a failure tells you about an open pin or gives an input pattern whose output is wrong. **start from parts** removes all wires. **reference** restores the original worked circuit.

one output can drive several inputs; that is fan-out. two unrelated outputs must not drive one net. joining outputs is not the same as OR: in physical hardware they may fight each other, and the simulator reports a short. an endpoint touching a wire creates a junction. a plain interior crossing is separate in this editor; our generated boards use explicit Cross parts wherever unrelated tracks cross.

these three little constructions establish a powerful result: nand is enough to express any finite combinational truth table. that is not a claim that the smallest or fastest circuit always uses nand exclusively. readable AND, XOR and MUX primitives will help us see the structure as the boards grow.
