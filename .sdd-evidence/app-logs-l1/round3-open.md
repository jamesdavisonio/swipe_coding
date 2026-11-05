# L1 fidelity round 3 — open list (verbatim from delta 2)

gaps: none

gaming_flags:

- tests/emulator/app-logs-7.test.ts (all four tests, the per-minute cap) — stub: a tumbling 60 s window with an arbitrary phase instead of a rolling window: (a) fixed to the first event, `if (start === null) start = now; while (now - start >= 60_000) { start += 60_000; count = 0 }`, passes all four tests in 200 of 600 modelled start seconds; (b) `Math.floor((Date.now() + 30_000) / 60_000)` buckets pass in 596 of 600. Tests 3 and 4 each probe one fixed phase, so a grid whose boundaries fall between them passes both. Fix: add a probe that works for any phase: from a fresh minute boundary U store one event every 3 s at U..U+57 s (assert all 20 stored), then at U+58 s assert one call is not stored (every 60 s grid except one starting exactly at U stores it), then at U+61 s assert one call is stored. Modelled: every listed stub fails, the rolling window passes 600 of 600.
