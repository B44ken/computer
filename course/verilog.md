## the readable description is not a second processor

we built the circuit from gates so there would be no mystery about what “subtract” and “hold the accumulator” mean. now we can describe those behaviors at register-transfer level, or RTL, and let synthesis find a gate network that implements them.

inside `always @(posedge clk)`, a nonblocking assignment describes a state update at the clock edge. its right-hand side is computed from the pre-edge values. all such updates commit together, which is the same discipline we used in the native simulator.

```verilog
module stupid (
    input wire clk,
    input wire [7:0] inst, in_mem,
    output wire we,
    output wire [7:0] out_mem,
    output wire [5:0] out_adr,
    output reg [5:0] out_pc = 0
);
    reg [7:0] a = 0;
    assign out_adr = inst[5:0];
    assign out_mem = a;
    assign we = inst[7:6] == 2'b01;
    always @(posedge clk) begin
        out_pc <= out_pc + 1'b1;
        case (inst[7:6])
            2'b00: a <= in_mem;
            2'b10: a <= a - in_mem;
            2'b11: if (a == 0) out_pc <= inst[5:0];
        endcase
    end
endmodule
```

absence of an accumulator assignment in STA and JZ means retain A. it does not mean “A has no value.” when a taken jump assigns PC later in the same block, that assignment takes precedence over the default increment. the result is a mux, not a CPU running an if statement.

## ask yosys for gates

save the source as stupid.v. run yosys with a synthesis script like this:

```sh
yosys -p '
read_verilog stupid.v
synth -top stupid -noabc
dffunmap
abc -g AND,NAND,OR,NOR,XOR,XNOR,MUX
clean
stat
write_verilog -noexpr gates.v
write_json gates.json
'
```

`synth` performs the generic lowering. `-noabc` leaves the final combinational mapping for the explicit ABC command. the gate list tells that mapping which combinational primitives we want; NOT is also available automatically. flip-flops come from the clocked behavior, not that gate list.

holding A may initially infer a clock-enabled DFF. `dffunmap` turns the enable into a feedback mux on a plain flip-flop’s input. that is exactly the load/hold circuit from the register lab. `write_verilog -noexpr` keeps explicit cells rather than printing the logic as compact Boolean expressions. JSON is usually easier for a programmatic importer.

initializers are part of this simulator-oriented design. carry the initial state through the netlist import rather than assuming every physical DFF starts at zero. for a real ASIC, specify and implement an appropriate startup mechanism separately.

## the graph is not the layout

synthesis gives you cells and nets. layout still has to assign gate positions, honor their actual pin coordinates, find wire paths, handle fan-out, and insert explicit crossovers on a single-plane board. changing the available gate set can change the number of gates and how hard they are to route.

the two existing boards on `/computer` both implement this four-instruction machine. the merged implementation builds their primitive descriptions in TypeScript: its automatic variant is not a general arbitrary-Verilog import button. the synthesis commands above produce a file you can inspect or import with a separately implemented adapter. we do not label a teaching example as a feature that does not exist.

## what to carry away

an electrical switch controls a path. gates make Boolean functions. adders and selectors compute candidate values. flip-flops hold state and capture it on an edge. memory associates values with addresses. instruction bits select which paths update which state. a program is a sequence of those selections stored as ordinary bytes.

the course ends at the fully editable computer, not at a picture of a processor box. open the workbench, trace one instruction, and change a wire. you now know enough to predict not just that it will break, but which part of the state transition it will break.
