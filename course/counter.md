## the next instruction needs an address

memory can provide a byte at an address. we still need a changing address that says which byte is the next instruction. that is the **program counter**, or PC. despite its name, it is not a special primitive. it is a register connected to logic that normally adds one.

start with a four-bit counter so you can trace the entire incrementer. bit 0 toggles every increment, so its next incremented value is NOT q0. bit 1 toggles when q0 was one. bit 2 toggles when both lower bits were one. in general a bit toggles when the lower bits generate a carry into it.

```text
inc0 = NOT q0
inc1 = q1 XOR q0
inc2 = q2 XOR (q1 AND q0)
inc3 = q3 XOR (q2 AND q1 AND q0)
```

we implement the multi-input conditions as chains of two-input ANDs. every state bit is still a DFF, and every choice remains a one-bit mux.

@@lab:counter

## count, and then refuse to count

leave jump low and pulse the clock. q3…q0 counts upward modulo 16. after 1111, the next increment is 0000. the carry into a fifth bit is simply not stored. this is the same fixed-width arithmetic rule as our adder.

now set the four target bits to 1010 and raise jump. a pulse loads 10 rather than the incremented value. with jump still high, another pulse reloads the target rather than advancing. lower jump and the next pulse advances from the currently stored value.

the **incrementer** computes one candidate next value. the **mux** chooses increment or target. the **DFFs** remember the choice. it is worth naming those jobs separately: they are the entire recipe for a program counter with jumps.

## from four bits to six

the final memory has 64 locations, so we extend the same circuit to six bits. normal execution increments PC modulo 64. a branch can instead load the six-bit address contained in the instruction.

in our eventual cpu the jump select will not be a button. it will be `is_jz AND accumulator_is_zero`. the target will not be four test inputs; it will be the instruction’s six low bits. the circuit does not understand “go back to the start of the loop.” it just chooses a value at its next-state mux.

## stop inventing more machinery than we need

there is no separate increment instruction, PC opcode register or “next line” software interpreter here. the PC naturally advances because its next-state circuit usually chooses the incrementer. a conditional branch is the exceptional choice.

a zero detector can also be entirely combinational: OR the accumulator bits together, then invert. a zero flag register would remember a previous comparison result, but our branch tests the current accumulator directly. avoiding that extra flag is useful for this intentionally tiny instruction set.

when you inspect the full board later, find these same three pieces. the topology may look busier because the control and target wires travel farther, but the state transition has not changed.
