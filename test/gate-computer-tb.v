`timescale 1ns/1ps
module tb;
  reg clk=0;
  wire [7:0] i0,i1,i2,d0,d1,d2,a0,a1,a2;
  wire [5:0] pc0,pc1,pc2,ad0,ad1,ad2;
  wire w0,w1,w2;
  stupid reference(clk,i0,d0,w0,a0,ad0,pc0);
  stupid_manual manual(clk,i1,d1,w1,a1,ad1,pc1);
  stupid_auto automatic_cpu(clk,i2,d2,w2,a2,ad2,pc2);
  stupid_memory m0(clk,pc0,ad0,w0,a0,i0,d0);
  stupid_memory m1(clk,pc1,ad1,w1,a1,i1,d1);
  stupid_memory m2(clk,pc2,ad2,w2,a2,i2,d2);
  reg [1023:0] program_file;
  integer cycles=256,cycle,j;
  initial begin
    if (!$value$plusargs("program=%s",program_file)) $fatal(1,"pass +program=path.hex");
    if (!$value$plusargs("cycles=%d",cycles)) cycles=256;
    #1;
    $readmemh(program_file,m0.ram); $readmemh(program_file,m1.ram); $readmemh(program_file,m2.ram);
    for(cycle=0;cycle<cycles;cycle=cycle+1) begin
      #4;
      if ({pc0,a0,w0,ad0,i0,d0} !== {pc1,a1,w1,ad1,i1,d1} || {pc0,a0,w0,ad0,i0,d0} !== {pc2,a2,w2,ad2,i2,d2})
        $fatal(1,"pre-edge mismatch at %0d",cycle);
      clk=1; #1;
      if({pc0,a0} !== {pc1,a1} || {pc0,a0} !== {pc2,a2}) $fatal(1,"post-edge mismatch at %0d",cycle);
      for(j=0;j<64;j=j+1) if(m0.ram[j]!==m1.ram[j]||m0.ram[j]!==m2.ram[j]) $fatal(1,"RAM mismatch at %0d/%0d",cycle,j);
      #4; clk=0;
    end
    $display("PASS: %0d clocks, both gate CPUs match stupid.v and RAM",cycles);
    $finish;
  end
endmodule
