## store more than one value

a register holds a word, but a program usually needs many words: input values, a result, constants, loop counters and instructions themselves. a memory gives each word an **address** so the same interface can select different storage locations.

start small enough to see every bit. this lab is two words of two bits each: four DFFs in total. the one-bit address selects word 0 or word 1. two data input bits carry the value to write. the read output is another two-bit word.

## decode the write, select the read

word 0’s load enable is `we AND NOT addr`; word 1’s is `we AND addr`. each enable controls two feedback muxes. when it is low, those DFFs recapture their existing values. when it is high, they capture the corresponding input data bits.

we do not gate the clock with the write address. all four DFFs share the same clock, and the data muxes determine which word changes. the read side uses two muxes, one per bit, selecting the corresponding stored bit from word 0 or word 1.

@@lab:ram

write 01 into word 0, then 10 into word 1. turn we off. toggle addr without pulsing the clock: the output should immediately show the selected stored word after the gates settle. pulse with we still off and different data inputs; neither stored word should change.

this is called an **asynchronous read, synchronous write** interface. “asynchronous” here describes the read port, not a clockless cpu or a separate execution thread. reads respond to the address; writes happen on a qualifying clock edge.

## scale the idea, then choose an abstraction boundary

one address bit selects two words. two bits select four, six bits select 64. an n-bit address can identify `2^n` words. each added address bit doubles the number of possible locations, not the number of bits in a word.

a literal 64×8 version made from our DFFs would need 512 storage bits before counting write decoding and read muxes. we have seen how that works. expanding all of it on the final teaching board would obscure the much smaller cpu. so **memory is the one permitted high-level interface** in the final machine. the processor’s registers, arithmetic and control remain individual gates.

## the price of an extremely small cpu

the final interface has two read ports. one returns the instruction byte at the program counter. the second returns the data byte at the address named by that instruction. one write port stores the accumulator when the cpu asserts write enable.

```text
instruction = memory[PC]
operand     = memory[instruction[5:0]]
```

these reads form a dependency: the operand address depends on the instruction read. both must settle before the next state capture. real memory hardware must provide these ports and enough time for the whole path. with a single-port or synchronous-read RAM, we would need additional cycles and likely an instruction register. the small cpu did not make that work disappear; it moved the requirement into the memory interface.

code and data share one array. storing into an address that will later be fetched as an instruction changes the program. we will test that deliberately, but accidental stores into code are also a very effective way to break it.
