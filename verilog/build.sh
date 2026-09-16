echo 'read_verilog stupid.v
      synth -top stupid -noabc
      abc -g AND,NAND,OR,NOR,XOR,XNOR,MUX,NOT,DFF
      dffunmap
      write_verilog out-stupid.v
      show' | yosys
