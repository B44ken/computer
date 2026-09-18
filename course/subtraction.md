## borrow an adder

we want a small instruction set. subtraction lets us transform a value, decrement a loop counter, manufacture zero, and compare two values for equality by subtracting one from the other. that makes it a useful single arithmetic operation.

for an n-bit word, complementing b gives `(2^n − 1) − b`. adding one gives `2^n − b`, which is equivalent to `−b` modulo `2^n`. therefore:

```text
a − b = a + (~b) + 1   (keep the low n result bits)
```

no software trick is involved. invert the b wires, connect the adder’s first carry input to 1, and keep the same carry chain. on the board below cin is a visible input button so you can see its role. **leave it high for subtraction**. turning it low gives a−b−1 instead.

@@lab:sub4

try a=9, b=4. the answer is 5. now try a=0, b=1. the stored four-bit result is 1111. read as unsigned it is 15; read as signed it is −1. arithmetic wraps modulo 16 because only four bits remain.

for this complemented-input adder, cout=1 means the unsigned subtraction did **not** need a borrow. when a≥b, the full addition reaches at least 16 and carries out. when a<b, it does not. this is not the same convention as a separate borrow-out signal, whose high value means a borrow did occur.

## one bit of an accumulator

our cpu’s persistent arithmetic value will be the **accumulator**, abbreviated A. its arithmetic instruction is `SUB x`: replace A with `A − memory[x]`. x is an address; it is not the number to subtract, and the order is not reversed.

the next lab exposes a single accumulator bit. two XORs compute a difference bit using an incoming borrow. a mux chooses either the memory bit or that difference. another mux chooses either the new value or old A. a flip-flop, which we will study in the next chapter, holds the chosen bit until a clock edge.

@@lab:accumulator

when a and m differ, the outgoing borrow equals m. when they are equal, it equals the incoming borrow. that means a one-bit MUX can compute the borrow chain. the final computer on the merged branch uses the equivalent `A + ~M + 1` carry formulation; this exercise shows a second useful way to reason about the same subtraction.

## useful operations without more opcodes

subtract a byte containing 1 to decrement. subtract a byte containing −1 to increment. load x and subtract x to get zero; load x and subtract y, then branch on zero, to test equality. none needs a separate compare instruction.

adding an arbitrary runtime y is a little longer because `−y` may not already exist. load a known zero, subtract y, and store that negative value in a temporary location. then load x and subtract the temporary. now the result is x+y modulo the word size. constants such as −1 can simply be stored in advance.

this is a choice about the balance between simple hardware and convenient programs. we are not claiming a subtractor is always smaller than an adder in every gate library. our aim is a machine whose entire control and datapath you can understand.
