`timescale 1ns/1ps
module tb;
  reg clk=0;
  wire [7:0] inst,data,a0,a1,a2;
  wire [5:0] pc0,pc1,pc2,address;
  wire w0,w1,w2;
  stupid reference(clk,inst,data,w0,a0,address,pc0);
  stupid_memory m0(clk,pc0,address,w0,a0,inst,data);
  computer_manual manual(clk,a1,pc1,w1);
  computer_auto automatic_cpu(clk,a2,pc2,w2);
  reg [1023:0] program_file;
  integer cycle,j;
  initial begin
    if(!$value$plusargs("program=%s",program_file)) $fatal(1,"pass +program=path.hex");
    #1;
    $readmemh(program_file,m0.ram);
    $readmemh(program_file,manual.memory.ram);
    $readmemh(program_file,automatic_cpu.memory.ram);
    for(cycle=0;cycle<256;cycle=cycle+1)begin
      #4;
      if({pc0,a0,w0}!=={pc1,a1,w1}||{pc0,a0,w0}!=={pc2,a2,w2})$fatal(1,"pre-edge %0d",cycle);
      clk=1;#1;
      if({pc0,a0}!=={pc1,a1}||{pc0,a0}!=={pc2,a2})$fatal(1,"post-edge %0d",cycle);
      for(j=0;j<64;j=j+1)if(m0.ram[j]!==manual.memory.ram[j]||m0.ram[j]!==automatic_cpu.memory.ram[j])$fatal(1,"RAM %0d/%0d",cycle,j);
      #4;clk=0;
    end
    $display("PASS: native wire-extracted CPUs match stupid.v for 256 clocks");$finish;
  end
endmodule
