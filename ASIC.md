# ASIC / Tiny Tapeout

This repository contains a Tiny Tapeout IHP 26b submission for the little computer.

- RTL: `src/project.v`
- project metadata/pinout: `info.yaml`
- cocotb verification: `test/`
- chip documentation: `docs/info.md`
- physical build/precheck/GL simulation: `.github/workflows/asic-gds.yaml`

The design targets one IHP SG13G2 Tiny Tapeout tile. GitHub Actions performs the LibreLane synthesis, place-and-route, precheck, and gate-level simulation.
