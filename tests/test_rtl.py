"""Compare original RTL + the uploaded Yosys netlist using real memory wiring."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
IVERILOG = os.environ.get('IVERILOG', 'iverilog')
VVP = os.environ.get('VVP', 'vvp')
IVL = os.environ.get('IVL_PATH')

with tempfile.TemporaryDirectory(prefix='stupid-rtl-') as tmp:
    work = Path(tmp)
    subprocess.run([str(ROOT / 'node_modules/.bin/tsx'), 'scripts/rtl-vectors.ts', tmp], cwd=ROOT, check=True)
    # Both modules receive the same memory interface; each has its own RAM.
    uploaded = (ROOT / 'hardware/stupid/uploaded-netlist.v').read_text().replace('module stupid(', 'module uploaded(')
    assert 'module uploaded(' in uploaded
    (work / 'uploaded.v').write_text(uploaded)
    bench = r'''
`timescale 1ns/1ps
module tb;
    reg clk = 0;
    wire [7:0] inst0, inst1, data0, data1, out0, out1;
    wire [5:0] pc0, pc1, addr0, addr1;
    wire we0, we1;
    stupid cpu0(clk, inst0, data0, we0, out0, addr0, pc0);
    uploaded cpu1(clk, inst1, data1, we1, out1, addr1, pc1);
    stupid_memory mem0(clk, pc0, addr0, we0, out0, inst0, data0);
    stupid_memory mem1(clk, pc1, addr1, we1, out1, inst1, data1);
    reg [1023:0] image;
    integer cycles, i, j;
    initial begin
        if (!$value$plusargs("image=%s", image)) $fatal(1, "missing image");
        if (!$value$plusargs("cycles=%d", cycles)) $fatal(1, "missing cycles");
        $readmemh(image, mem0.bytes);
        $readmemh(image, mem1.bytes);
        #1;
        for (i = 0; i <= cycles; i = i + 1) begin
            if ({pc0, out0, we0, addr0, inst0, data0} !== {pc1, out1, we1, addr1, inst1, data1})
                $fatal(1, "RTL/uploaded netlist disagree at cycle %d", i);
            for (j = 0; j < 64; j = j + 1)
                if (mem0.bytes[j] !== mem1.bytes[j]) $fatal(1, "memory mismatch");
            $write("STATE %0d %0d %0d", i, pc0, out0);
            for (j = 0; j < 64; j = j + 1) $write(" %0d", mem0.bytes[j]);
            $write("\n");
            #4; clk = 1; #5; clk = 0; #1;
        end
        $finish;
    end
endmodule
'''
    (work / 'tb.v').write_text(bench)
    args = [IVERILOG] + (['-B', IVL] if IVL else []) + ['-g2012', '-s', 'tb', '-o', str(work / 'tb'), str(ROOT / 'hardware/stupid/stupid.v'), str(ROOT / 'hardware/stupid/memory.v'), str(work / 'uploaded.v'), str(work / 'tb.v')]
    subprocess.run(args, check=True)
    total = 0
    for case in json.loads((work / 'cases.json').read_text()):
        result = subprocess.run([VVP] + (['-M', IVL] if IVL else []) + [str(work / 'tb'), f'+image={work / (case["id"] + ".hex")}', f'+cycles={case["cycles"]}'], capture_output=True, text=True, check=True)
        memory = case['image'][:]
        pc = a = 0
        states = [line.split()[1:] for line in result.stdout.splitlines() if line.startswith('STATE ')]
        assert len(states) == case['cycles'] + 1, result.stdout
        for cycle, line in enumerate(states):
            values = list(map(int, line))
            assert values == [cycle, pc, a, *memory], (case['id'], cycle, values, [pc, a])
            inst = memory[pc]
            op, address = inst >> 6, inst & 63
            operand = memory[address]
            next_pc = address if op == 3 and a == 0 else (pc + 1) & 63
            if op == 0: a = operand
            elif op == 1: memory[address] = a
            elif op == 2: a = (a - operand) & 255
            pc = next_pc
        total += case['cycles']
    print(f'passed: original RTL and uploaded netlist, 38 images, {total} clock edges, every register and memory byte')
