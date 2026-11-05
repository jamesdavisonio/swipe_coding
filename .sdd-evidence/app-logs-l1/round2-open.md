# L1 fidelity round 2 — open list (verbatim from delta 1)

gaps: none

gaming_flags:

- tests/emulator/app-logs-7.test.ts::the minute is rolling, not the clock minute — stub: fixed window anchored at the first stored event (if (Date.now() - start >= 60_000) { start = Date.now(); count = 0 }) instead of a rolling 60-second window; every burst happens at one frozen instant, so it refuses at +30 s and resets at +61 s exactly like a rolling window, yet can store ~40 events in 60 s across its reset. Fix: Keep the existing +30 s check (it catches the clock-minute stub) and add a spread burst: at a fresh time T store 1 failure, at T+40 s store 19 (20 stored), then at T+61 s call twice and assert the first is stored and the second is not (rolling still holds the 19 from T+40 s; an anchored window resets at T+60 s and stores both).

Gap 2 (request_id) and gaming flag 2 closed.

Reviewer notes: window length only pinned between 31 and 61 s; whether a refused attempt counts toward the window is untested (the contract counts only stored events).
