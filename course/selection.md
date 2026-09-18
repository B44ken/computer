## a datapath needs choices

suppose one part of a machine computes a subtraction result and another has a value freshly read from memory. both might need to reach the accumulator, but not at the same time. joining their output wires together would be a short. we need a circuit that chooses one.

a **multiplexer**, or mux, takes data inputs a and b, a select input s, and produces one output. our convention is `s=0 → a`, `s=1 → b`. the convention matters more than the shape of the symbol: swapping the data pins changes which value each select state chooses.

## build the choice from gates

when s is zero, we want a to pass and b to be blocked. `a AND NOT s` does that. when s is one, we want b to pass and a to be blocked; `b AND s` does that. OR the two results. only one path can be enabled for a settled binary select.

```text
out = (a AND NOT s) OR (b AND s)
```

@@lab:mux

try a=1 and b=0, then toggle s. next make a and b equal. changing s should no longer change the output: the choice is between two identical values. that is a useful test of whether you have mistaken select for an arithmetic input.

we will soon use a single **MUX** component for this truth table. its interior can be the four gates you just wired; using the primitive makes the larger datapath legible. unlike an “ALU” or “register” box, it still makes only a one-bit combinational choice. a four-bit mux is four such gates with a shared select signal, not four select bits.

## sharing is not crossing

one control signal can fan out to the select pins of all four muxes. those connections really are one electrical net. contrast that with two wires that happen to cross in a picture: they must keep their own values unless we deliberately make a junction.

our editor has a native **Cross** component. it has four corner pins, with independent directional paths TL → BR and TR → BL. it does not AND, OR or XOR its inputs. it is the simulator’s version of taking one connection over the other with an insulated jumper.

@@lab:cross

change a without changing b. qa should follow a while qb stays put. then reverse the roles. the four-input-state test is deliberately simple: a crossover that accidentally joins the paths can look fine when both signals are zero or both are one.

## geometry becomes part of correctness

with a netlist, a connection is an abstract relationship between pins. on this board it must also be a path through space. a gate has a size and pin coordinates. a wire cannot go through its body; a jumper needs enough room for its own footprint. a visually plausible line that misses a pin is not a connection.

this is why placing gates and routing nets is a separate problem from deciding what logic to build. we will use automatic routing for much of the course so we can concentrate on the machine, but its result is real editor wiring. you can drag a gate away from its wires and break the circuit. the eventual computer is subject to precisely the same rule.
