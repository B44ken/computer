## the wires do not know about numbers

a bundle of eight wires is eight signals. it is not physically more “a number” than a row of eight lamps. we make it a number by assigning weights and agreeing which end is which.

in ordinary unsigned binary, bit 0 has weight 1, bit 1 has weight 2, then 4, 8, 16, 32, 64 and 128. add the weights of the bits that are high. written binary numbers usually put the highest-weight bit at the left, even though the board labels start with b0, the least-significant bit.

```text
bit:     7   6   5   4   3   2   1   0
weight:128  64  32  16   8   4   2   1
value:   0   0   1   0   1   0   1   0

00101010 = 32 + 8 + 2 = 42
```

@@lab:byte

## try making a number rather than counting up to it

set the board to 42 by raising bits 5, 3 and 1. then make 128 with one bit, and 127 with the other seven. making 128 does not require physically “more signal” than 127. the pattern changed; the meaning comes from our weights.

with n independent bits, there are `2^n` patterns. eight bits give 256 patterns, so an unsigned byte ranges from 0 through 255. six bits give 64 patterns, so a six-bit address can select locations 0 through 63. the last number is one less than the count because we start at zero.

an **address** tells us which location to read. the **data** is the value found there. if address 12 contains 4, reading memory[12] gives 4, not 12. our final computer has six-bit addresses and eight-bit values: 64 locations, each holding one byte. the widths need not match.

## negative numbers do not need negative logic voltages

a convenient signed convention is two’s complement. for an eight-bit word, give the top bit weight −128 rather than +128. the lower bits keep their positive weights. `11111111` then means −128 + 127, or −1. `10000000` means −128, while `01111111` means +127.

the exact same eight wires can still be interpreted as unsigned 255 and 128. there is no switch hidden in the wires that decides which interpretation is correct. the instruction, program and readout convention determine that. our little cpu simply stores eight result bits; its arithmetic naturally wraps modulo 256.

## hexadecimal is a shorter way to write bits

four bits fit in one hexadecimal digit, 0 through f. `0010 1010` becomes `0x2a`: 2×16 + 10. a byte takes two hex digits, but it is still the same eight bits. decimal, binary and hexadecimal are ways to write a value, not distinct storage technologies.

“little-endian” and “big-endian” concern the order of multiple bytes in a larger value. they are not another word for labeling bit zero. this machine only uses one-byte instructions and values, so we do not need a multi-byte convention yet.

before moving on, verify every input reaches the corresponding lamp. a perfectly connected byte bundle can carry any of its 256 patterns. **check wiring** tests all of them; seeing 42 once is not the same as checking every bit path.
