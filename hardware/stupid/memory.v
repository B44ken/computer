`default_nettype none

// The one permitted high-level device: 64 bytes with two asynchronous reads.
// Both reads and the write share the SAME array, including program bytes.
module stupid_memory (
    input wire clk,
    input wire [5:0] pc,
    input wire [5:0] address,
    input wire we,
    input wire [7:0] write_data,
    output wire [7:0] instruction,
    output wire [7:0] read_data
);
    reg [7:0] bytes [0:63];
    assign instruction = bytes[pc];
    assign read_data = bytes[address];
    // Nonblocking assignment samples the old CPU outputs at the same edge
    // as the CPU's flip-flops. Never write using the next instruction's pins.
    always @(posedge clk)
        if (we) bytes[address] <= write_data;
endmodule

`default_nettype wire
