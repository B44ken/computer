## arithmetic is a truth table too

start with two one-bit numbers. their sum can be 0, 1 or 2, so a one-bit output is not enough. write the answer as two bits: a low **sum** bit and a high **carry** bit.

```text
a b | carry sum
0 0 |   0    0
0 1 |   0    1
1 0 |   0    1
1 1 |   1    0
```

the sum column is XOR; the carry column is AND. that is a **half adder**. we did not program an arithmetic operation into the simulator. two ordinary gates happen to have the truth tables needed to represent addition.

@@lab:half

## the previous column has something to say

when adding a multi-bit value, a column may also receive a carry from the lower column. now it has three input bits: a, b and cin. their total ranges from 0 through 3, still requiring two output bits. this is a **full adder**.

first form `p = a XOR b`. the low sum is `p XOR cin`. a carry is generated whenever both a and b are one; otherwise it propagates from cin when exactly one of a and b is one. that gives a direct gate construction:

```text
p    = a XOR b
sum  = p XOR cin
cout = (a AND b) OR (p AND cin)
```

@@lab:full

set all three inputs high. the outputs should be cout=1 and sum=1, meaning 3. then try just one high input: sum should be 1 and cout 0. the checker tries every one of the eight combinations.

## repeat the slice

put four full adders beside one another. the carry from bit 0 feeds bit 1, then bit 2, then bit 3. corresponding a and b bits enter each slice. the four sum outputs form the result, and the last carry is an extra high bit.

@@lab:adder4

a0 and b0 are the low-order input bits. try 3 + 5 with cin=0: q3…q0 should be 1000. then try 15 + 1: the four result bits become 0000 and cout becomes 1. the circuit has computed 10000, but a four-bit destination can only retain its low four bits.

although the carry is passed from one slice to the next, there is not a clock tick per slice. this whole adder is **combinational**. changes propagate through gates until the answer settles. a real ripple adder’s worst path passes through a carry chain, so more bits can mean more time before the answer is safe to capture. this ideal simulator shows the settled value rather than measuring transistor delays.

## carry is not signed overflow

for unsigned four-bit numbers, 15+1 exceeds the available range and produces carry-out. for signed four-bit numbers, 7+1 produces the bits 1000, which represent −8 under the signed convention. that is signed overflow even though there was no carry out of bit 3. the same gate network produced both results; the interpretation changed.

we will not store either a carry flag or an overflow flag in our final cpu. we only need the low eight bits and a zero test. it is still worth understanding the discarded information: throwing it away is a design choice, not evidence that the adder failed.
