## the whole processor is now familiar pieces

we are using the computer from the merged main branch, not introducing a new software emulator. its arithmetic is made of individual gates, its accumulator has eight DFFs, and its program counter has six. the memory interface is the only larger component. clock is an ordinary stimulus button connected to the real clock pins.

there is no instruction register. memory provides the instruction combinationally from PC; the instruction’s low six bits provide the operand address. there is no stored zero flag. an OR reduction followed by inversion determines whether the current accumulator is zero.

@@lab:computer

## trace one full cycle before running quickly

first, the PC outputs select an instruction byte from memory. those eight instruction signals split into control and address wires. the address selects the operand byte. the control bits determine whether the accumulator should load memory data, load the subtractor result, or retain its value.

at the same time, the PC incrementer computes PC+1. the zero detector and branch decode decide whether its mux should select that increment or the address bits. these are not sequential software steps being executed by another cpu: they are connected combinational paths that settle between edges.

on the rising clock edge, **all DFFs and the memory write port sample their old, settled inputs**. only after every sample do state outputs change. on a store, memory therefore uses the instruction and accumulator from before the edge, not a new instruction selected after PC advances.

once state changes, the wires settle again for the next instruction. a full low→high→low pulse executes one instruction. leaving the clock high and repeatedly evaluating the circuit must not execute more instructions.

## build it rather than trust the picture

choose repair to remove a real accumulator input wire. the machine still has its gate objects and much of its wiring, but it is no longer correct. follow the missing D input back to its selector output, reconnect it with Wire, and run the checks. inspecting the Q output shows the currently stored bit; inspecting D shows the candidate next bit.

for a more substantial build, select start from parts. the individual gates and memory remain placed, but every connection is removed. the reference view is available to study the layout. building from parts is optional for the larger cpu: the repair task and program tests are the required checkpoint. building the smaller slices first is usually a better way to understand it than copying thousands of segments.

## test behavior and structure separately

an appealing schematic is not evidence that it computes correctly. conversely, an instruction interpreter could produce correct answers while its drawing was decorative. here the checks operate on a serialized copy of the **actual native Circuit**, so your current wiring determines the results. missing wires remain missing. tests do not repair the machine by restoring logical net connections.

the complete-computer checkpoint runs five programs on the current wiring: load/store with underflow, countdown, multiplication, fibonacci, and self-modifying code. the repository’s deeper tests compare arithmetic and memory behavior against an independent expected model. the checker runs on a copy so it does not consume the state you were inspecting.

## what we have—and have not—built

we have an educational, synchronous, gate-level processor with a specified memory interface. the diagram is an editable logic schematic, not a manufactured PCB or timing-verified ASIC. the ideal simulator does not estimate clock frequency, power, wire resistance or metastability. the circuit’s initial zero state is explicit simulator initialization.

none of those qualifications makes it “just a picture.” the arithmetic, selection, state and physical editor connections really execute here. we can now leave the hardware alone and change only the memory image to make the same machine do different things. that is programming.
