module stupid (
    input  wire       clk,
    input  wire [7:0] inst,
    input  wire [7:0] in_mem,

    output wire       we,
    output wire [7:0] out_mem,
    output wire [5:0] out_adr,
    output reg  [5:0] out_pc = 0
);
    reg [7:0] a = 0;
    assign out_adr = inst[5:0];
    assign out_mem = a;
    assign we = inst[7:6] == 1;

    always @(posedge clk) begin
        out_pc <= out_pc + 1;
        case (inst[7:6])
            0:
                a <= in_mem;
            2:
                a <= a - in_mem;
            3:
                if (a == 0) out_pc <= inst[5:0];
        endcase
    end
endmodule
