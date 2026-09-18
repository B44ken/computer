## an instruction is not a command somebody reads

we have enough parts to describe the machine: accumulator, subtractor, PC, memory and selectors. what turns a fetched byte into “load,” “store,” “subtract” or “jump”? a few gates that decode its top two bits.

our instruction format is fixed and one byte long:

```text
bit       7 6 | 5 4 3 2 1 0
          op  |   address

00 xxxxxx     LDA x   A ← memory[x]
01 xxxxxx     STA x   memory[x] ← A
10 xxxxxx     SUB x   A ← A − memory[x]
11 xxxxxx     JZ  x   if A = 0, PC ← x
```

x names a memory location or branch destination, not an immediate arithmetic value. every instruction occupies one byte. there is no second operand byte and no hidden instruction length decoder.

## turn the opcode into wires

with two input bits there are four possible patterns. combine each bit or its complement in an AND to recognize one pattern. the decoder below shows four outputs, with exactly one high for each input combination.

@@lab:decode

this one-hot decoder is useful for understanding the operations, but we need not build all four named outputs in the smallest implementation. some control signals are simpler when derived directly from the opcode bits.

write enable is high for opcode 01: `NOT inst[7] AND inst[6]`. accumulator load is permitted for opcodes 00 and 10: both have `inst[6]=0`. while loading, `inst[7]` chooses direct memory data or the subtractor output. JZ is opcode 11, so a taken jump is `inst[7] AND inst[6] AND zero`.

```text
write_memory = NOT high AND low
write_A      = NOT low
choose_sub   = high
take_jump    = high AND low AND zero
```

those signals feed the muxes and memory write-enable pin. that is the decoder’s entire effect. names such as “LDA” exist in our explanation and assembler; inside the circuit they are just particular signal combinations.

## trace one byte

take `10 001101`, or hexadecimal 8d. its top bits request subtraction, and its address bits request location 13. the memory operand read returns memory[13]. the subtractor computes A minus that byte; the data selector chooses that result; the hold selector permits writing A. PC chooses its incremented value. the next rising edge captures those two results.

for a store, the accumulator and address wires already carry the right values. the decoder merely asserts WE. accumulator feedback keeps A unchanged, while PC advances. for JZ, A is held too, but the PC mux may choose the target instead.

## choose a simple contract and stick to it

this machine has no immediate load, carry branch, stack, call, input/output instruction, or hardware halt. that is intentional. constants occupy memory locations, subroutines would need a software convention, and examples stop by repeatedly executing a branch to themselves with A=0.

these are limitations of our chosen architecture, not limitations of logic gates or Verilog. adding instructions means adding encodings, selecting additional datapath behavior, and verifying more cases. first we will make these four work all the way from individual wires to programs.
