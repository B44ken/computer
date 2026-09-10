import cocotb
from cocotb.clock import Clock
from cocotb.triggers import ClockCycles, FallingEdge

async def reset(dut):
    dut.ena.value = 1
    dut.ui_in.value = 0
    dut.uio_in.value = 0
    dut.rst_n.value = 0
    await ClockCycles(dut.clk, 4)
    dut.rst_n.value = 1

async def run_with_memory(dut, image, max_cycles=500):
    mem = bytearray(256)
    mem[:len(image)] = image
    latched_addr = 0
    for _ in range(max_cycles):
        await FallingEdge(dut.clk)
        uo = int(dut.uo_out.value)
        oe = int(dut.uio_oe.value)
        ale = uo & 1
        rd_n = (uo >> 1) & 1
        wr_n = (uo >> 2) & 1
        halted = (uo >> 3) & 1
        if ale:
            assert oe == 0xFF
            latched_addr = int(dut.uio_out.value)
        if not rd_n:
            assert oe == 0x00
            dut.uio_in.value = mem[latched_addr]
        else:
            dut.uio_in.value = 0
        if not wr_n:
            assert oe == 0xFF
            mem[latched_addr] = int(dut.uio_out.value)
        if halted:
            return mem
    raise AssertionError("CPU did not halt")

@cocotb.test()
async def test_arithmetic_and_memory(dut):
    cocotb.start_soon(Clock(dut.clk, 1, unit="us").start())
    await reset(dut)
    program = bytes([
        0x10, 0x05, 0x30, 0x80, 0x10, 0x03, 0x40, 0x80,
        0x30, 0x81, 0x50, 0x80, 0x30, 0x82, 0xF0,
    ])
    mem = await run_with_memory(dut, program)
    assert mem[0x80] == 5
    assert mem[0x81] == 8
    assert mem[0x82] == 3
    assert (int(dut.uo_out.value) >> 4) == 3

@cocotb.test()
async def test_branch_input_and_not(dut):
    cocotb.start_soon(Clock(dut.clk, 1, unit="us").start())
    await reset(dut)
    dut.ui_in.value = 0xA5
    program = bytearray(16)
    program[0:2] = bytes([0x10, 0x00])
    program[2:4] = bytes([0xA0, 0x08])
    program[4:6] = bytes([0x10, 0xFF])
    program[6] = 0xF0
    program[8] = 0xD0
    program[9:11] = bytes([0x30, 0x90])
    program[11] = 0xE0
    program[12:14] = bytes([0x30, 0x91])
    program[14] = 0xF0
    mem = await run_with_memory(dut, bytes(program))
    assert mem[0x90] == 0xA5
    assert mem[0x91] == 0x5A
    assert (int(dut.uo_out.value) >> 4) == 0xA
