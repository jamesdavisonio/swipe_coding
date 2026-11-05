# L1 fidelity round 4 — open list (verbatim from delta 3)

gaps: none

gaming_flags:

- tests/emulator/app-logs-7.test.ts, all five (per-minute cap) — stub: clock-aligned sub-bucket window: keep the last 60/g buckets of Math.floor(Date.now()/g), refuse when their sum >= 20 (e.g. two 30 s buckets, prev + cur >= 20). Equally cheap as the closed stub (b); its effective window is only 60-g..60 s, so it can store 40 events in ~31 s. Passes all five tests deterministically for g = 2,3,5,10,15,20,30 s at offset 0 (offsets 0-1.75 s pass), because every probe sits on a whole-minute boundary and the trickle starts exactly on one. Fix: Start the trickle half a second before the minute: at = Math.ceil((Date.now() + 60 * 60_000) / 60_000) * 60_000 - 500, keeping the 3 s steps and the probes 58 s (not stored) and 61 s (stored, total 21) after the start. Modelled: rolling passes at every start phase; 60 s grids fail at every offset; clock-aligned 3-30 s bucket windows fail; only 1-2 s buckets (window >= 58 s, effectively correct) still pass.
