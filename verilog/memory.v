`default_nettype none
// One shared 64-byte memory: two asynchronous read ports, one rising-edge write.
// It is deliberately the only behavioral component above a scalar DFF.
module stupid_memory #(
    parameter INIT_FILE = ""
)(
    input wire clk,
    input wire [5:0] pc,
    input wire [5:0] address,
    input wire we,
    input wire [7:0] write_data,
    output wire [7:0] inst,
    output wire [7:0] read_data
);
    reg [7:0] ram [0:63];
    integer i;
    initial begin
        for (i = 0; i < 64; i = i + 1) ram[i] = 0;
        if (INIT_FILE != "") $readmemh(INIT_FILE, ram);
    end
    assign inst = ram[pc];
    assign read_data = ram[address];
    always @(posedge clk)
        if (we) ram[address] <= write_data;
endmodule
`default_nettype wire
