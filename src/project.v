`default_nettype none

module tt_um_b44ken_littlecomputer (
    input  wire [7:0] ui_in,
    output wire [7:0] uo_out,
    input  wire [7:0] uio_in,
    output wire [7:0] uio_out,
    output wire [7:0] uio_oe,
    input  wire       ena,
    input  wire       clk,
    input  wire       rst_n
);

    localparam [2:0]
        S_FETCH_ADDR   = 3'd0,
        S_FETCH_READ   = 3'd1,
        S_OPERAND_ADDR = 3'd2,
        S_OPERAND_READ = 3'd3,
        S_MEM_ADDR     = 3'd4,
        S_MEM_READ     = 3'd5,
        S_MEM_WRITE    = 3'd6,
        S_HALT         = 3'd7;

    reg [2:0] state;
    reg [7:0] pc;
    reg [7:0] acc;
    reg [7:0] ir;
    reg [7:0] mem_addr;
    reg       flag_z;
    reg       flag_c;
    reg       halted;

    reg [7:0] bus_out;
    reg       bus_drive;
    reg       ale;
    reg       rd_n;
    reg       wr_n;

    wire [8:0] add_result = {1'b0, acc} + {1'b0, uio_in};
    wire [7:0] sub_result = acc - uio_in;

    always @(posedge clk) begin
        if (!rst_n) begin
            state    <= S_FETCH_ADDR;
            pc       <= 8'h00;
            acc      <= 8'h00;
            ir       <= 8'h00;
            mem_addr <= 8'h00;
            flag_z   <= 1'b1;
            flag_c   <= 1'b0;
            halted   <= 1'b0;
        end else if (ena) begin
            case (state)
                S_FETCH_ADDR: state <= S_FETCH_READ;

                S_FETCH_READ: begin
                    ir <= uio_in;
                    pc <= pc + 8'd1;
                    case (uio_in[7:4])
                        4'h0: state <= S_FETCH_ADDR;
                        4'hD: begin
                            acc    <= ui_in;
                            flag_z <= (ui_in == 8'h00);
                            state  <= S_FETCH_ADDR;
                        end
                        4'hE: begin
                            acc    <= ~acc;
                            flag_z <= (~acc == 8'h00);
                            state  <= S_FETCH_ADDR;
                        end
                        4'hF: begin
                            halted <= 1'b1;
                            state  <= S_HALT;
                        end
                        default: state <= S_OPERAND_ADDR;
                    endcase
                end

                S_OPERAND_ADDR: state <= S_OPERAND_READ;

                S_OPERAND_READ: begin
                    pc <= pc + 8'd1;
                    case (ir[7:4])
                        4'h1: begin
                            acc    <= uio_in;
                            flag_z <= (uio_in == 8'h00);
                            state  <= S_FETCH_ADDR;
                        end
                        4'h9: begin
                            pc    <= uio_in;
                            state <= S_FETCH_ADDR;
                        end
                        4'hA: begin
                            if (flag_z) pc <= uio_in;
                            state <= S_FETCH_ADDR;
                        end
                        4'hB: begin
                            if (!flag_z) pc <= uio_in;
                            state <= S_FETCH_ADDR;
                        end
                        4'hC: begin
                            if (flag_c) pc <= uio_in;
                            state <= S_FETCH_ADDR;
                        end
                        default: begin
                            mem_addr <= uio_in;
                            state    <= S_MEM_ADDR;
                        end
                    endcase
                end

                S_MEM_ADDR: begin
                    if (ir[7:4] == 4'h3)
                        state <= S_MEM_WRITE;
                    else
                        state <= S_MEM_READ;
                end

                S_MEM_READ: begin
                    case (ir[7:4])
                        4'h2: begin
                            acc    <= uio_in;
                            flag_z <= (uio_in == 8'h00);
                        end
                        4'h4: begin
                            acc    <= add_result[7:0];
                            flag_c <= add_result[8];
                            flag_z <= (add_result[7:0] == 8'h00);
                        end
                        4'h5: begin
                            acc    <= sub_result;
                            flag_c <= (acc >= uio_in);
                            flag_z <= (sub_result == 8'h00);
                        end
                        4'h6: begin
                            acc    <= acc & uio_in;
                            flag_z <= ((acc & uio_in) == 8'h00);
                        end
                        4'h7: begin
                            acc    <= acc | uio_in;
                            flag_z <= ((acc | uio_in) == 8'h00);
                        end
                        4'h8: begin
                            acc    <= acc ^ uio_in;
                            flag_z <= ((acc ^ uio_in) == 8'h00);
                        end
                        default: begin end
                    endcase
                    state <= S_FETCH_ADDR;
                end

                S_MEM_WRITE: state <= S_FETCH_ADDR;
                S_HALT: state <= S_HALT;
                default: state <= S_FETCH_ADDR;
            endcase
        end
    end

    always @* begin
        bus_out   = 8'h00;
        bus_drive = 1'b0;
        ale       = 1'b0;
        rd_n      = 1'b1;
        wr_n      = 1'b1;

        if (ena && rst_n) begin
            case (state)
                S_FETCH_ADDR: begin
                    bus_out = pc; bus_drive = 1'b1; ale = 1'b1;
                end
                S_FETCH_READ: rd_n = 1'b0;
                S_OPERAND_ADDR: begin
                    bus_out = pc; bus_drive = 1'b1; ale = 1'b1;
                end
                S_OPERAND_READ: rd_n = 1'b0;
                S_MEM_ADDR: begin
                    bus_out = mem_addr; bus_drive = 1'b1; ale = 1'b1;
                end
                S_MEM_READ: rd_n = 1'b0;
                S_MEM_WRITE: begin
                    bus_out = acc; bus_drive = 1'b1; wr_n = 1'b0;
                end
                default: begin end
            endcase
        end
    end

    assign uio_out = bus_out;
    assign uio_oe  = {8{bus_drive}};
    assign uo_out = {acc[3:0], halted, wr_n, rd_n, ale};

endmodule

`default_nettype wire
