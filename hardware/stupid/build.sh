#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# init attributes are intentionally kept: the simulator honours power-up state.
"${YOSYS:-yosys}" -p '
  read_verilog stupid.v
  synth -top stupid -noabc
  dffunmap
  abc -g AND,NAND,OR,NOR,XOR,XNOR,MUX
  clean
  check -assert
  stat
  write_json gates.json
  write_verilog -noexpr gates.v
'
