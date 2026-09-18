## numbers that happen to be instructions

an assembler turns names into bytes. `LDA 50` becomes `(0 << 6) | 50`. `STA 60` becomes `(1 << 6) | 60`, or 124. a label is the assembler remembering an address for you, not a string stored in the processor.

our assembler supports labels, decimal and hexadecimal operands, semicolon comments, `.org` to choose an address, and `.byte` to place a data byte. instructions and data occupy the same 64-byte image. `.org 60` means “write subsequent bytes starting at address 60,” not “execute a jump to 60.”

## a first complete program

load x, subtract y, store the result. then load a known zero and branch to the current address forever. the viewer may pause at that loop; there is no special halt opcode.

```asm
lda x
sub y
sta result
lda zero
park: jz park
.org 56
x: .byte 9
y: .byte 4
zero: .byte 0
.org 60
result: .byte 0
```

memory[60] becomes 5. changing x and y changes the answer without changing the hardware. a good next test is x=0, y=1: the result should be 255, because our accumulator has eight bits and wraps modulo 256.

## a loop from only one branch condition

a countdown decrements a memory byte, stores it, and tests whether the new A is zero. when it is not zero, load a known zero and use JZ as an unconditional jump back to the loop.

```asm
loop: lda count
sub one
sta count
jz done
lda zero
jz loop
done: jz done
.org 56
one: .byte 1
zero: .byte 0
count: .byte 4
```

notice the order. if the loop starts at zero and you decrement before testing, it wraps to 255 and takes another 255 decrements to return to zero. for an algorithm that should run zero iterations, test before decrementing. boundary cases reveal assumptions that a single positive example hides.

## add without an ADD opcode

to add runtime x and y, first form −y with `LDA zero; SUB y` and store it in a temporary. then load x and subtract that temporary. x−(−y) is x+y modulo 256. to multiply, repeat an addition or subtract a negative operand while counting iterations. the instruction set stays tiny; the program becomes longer.

## your program is the missing piece

write a program that reads x at memory[50], writes `2*x modulo 256` to memory[60], and finishes in a JZ-to-self loop with A=0. addresses 50 and 60 are reserved by this exercise; put your constants and temporaries elsewhere. the starter contains only the parking loop, so it cannot pass by accident for every test value.

@@programming

**test program** runs the actual gate computer for six separate inputs, including zero, 127, 128 and 255. the inputs are installed after assembly. hardcoding the answer for x=3 will not pass. compare the signed interpretation only after the byte arithmetic: doubling 128 produces byte zero, not a ninth stored bit.

the editor also accepts the examples above. assembling shows the bytes and addresses; stepping shows current A and PC as values read from real flip-flop pins. code errors report an assembly line rather than silently producing a different instruction.

## the program can modify itself

because code and data share memory, STA can write an instruction byte that a later fetch reads. this is how the repository’s self-modifying example skips a store: it replaces that future instruction with a JZ byte, then branches there with a zero accumulator. the memory does not distinguish “code” and “data”; which read port consumes a byte gives it its role.

that also explains why addresses matter. use a scratch byte inside the code by accident, and the program may change while it runs. tracing the write-enable signal and write address is often more informative than staring only at the final answer.
