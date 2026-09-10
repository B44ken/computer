# Brad's Little Computer

An 8-bit accumulator CPU intended to fit a single Tiny Tapeout IHP tile. It has an 8-bit accumulator, 8-bit program counter, zero/carry flags, and a 256-byte external address space. Program/data memory is external so silicon area is spent on the CPU rather than flip-flop RAM.

## external memory bus

`AD[7:0]` is multiplexed like an early microprocessor bus. An external 8-bit latch captures the address while `ALE` is high. During a read the CPU releases `AD` and asserts active-low `RD_n`; memory drives the byte. During a write the CPU drives `AD` with `A` and asserts active-low `WR_n`.

## ISA

The instruction upper nibble is the opcode; the lower nibble is reserved. Instructions with immediate/address operands consume the next byte.

| opcode | bytes | operation |
|---|---:|---|
| `0x0_` | 1 | NOP |
| `0x1_ imm` | 2 | A = imm |
| `0x2_ addr` | 2 | A = mem[addr] |
| `0x3_ addr` | 2 | mem[addr] = A |
| `0x4_ addr` | 2 | A = A + mem[addr] |
| `0x5_ addr` | 2 | A = A - mem[addr], C=1 means no borrow |
| `0x6_ addr` | 2 | A = A & mem[addr] |
| `0x7_ addr` | 2 | A = A | mem[addr] |
| `0x8_ addr` | 2 | A = A ^ mem[addr] |
| `0x9_ addr` | 2 | jump |
| `0xA_ addr` | 2 | jump if zero |
| `0xB_ addr` | 2 | jump if nonzero |
| `0xC_ addr` | 2 | jump if carry |
| `0xD_` | 1 | A = IN[7:0] |
| `0xE_` | 1 | A = ~A |
| `0xF_` | 1 | halt until reset |

`A[3:0]` is mirrored on `uo[7:4]` for LEDs/debugging. Reset starts execution at `0x00`. Nominal clock is 1 MHz for breadboard-friendly external memory timing.

The cocotb tests emulate the external address latch and 256-byte memory and run programs covering immediate loads, memory loads/stores, arithmetic, conditional jumps, input, complement, halt, and bus direction.
