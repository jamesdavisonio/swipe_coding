# L1 fidelity round 1 — open list (verbatim from the full audit)

gaps:

1. missing-edge-case — tests/emulator/app-logs-7.test.ts::stores again once the minute has rolled on — The contract says the cap counts events in the last 60 seconds (rolling), but the tests only check a single burst and then +61 s, so a clock-minute bucket that can store 40 events in 60 s across a boundary passes. Fix: After the 20-event burst, move Date forward about 30 s and assert the next failure is not stored, then move it past 60 s from the burst and assert it is stored.
2. missing-edge-case — tests/emulator/app-logs-1.test.ts::stores a warning with every field at the next flush — The contract's rule that `request_id` is `context.request_id` only when it is a string (else null) is untested, so a store copying any value through passes, and the rules then refuse the whole batch and silently lose every other event in it. Fix: Log one event with a numeric `context.request_id` in the same flush as a normal event and assert both are stored, the first with `request_id: null`.

gaming_flags:

- tests/emulator/app-logs-7.test.ts::stores 20 in a minute; every one is still written to stderr — stub: a fixed clock-minute counter (Math.floor(Date.now()/60000)) rather than a rolling 60-second window.
- tests/emulator/app-logs-1.test.ts::stores a warning with every field at the next flush — stub: request_id: event.context.request_id ?? null — copies a non-string request id through, so the rules refuse the whole batch.

Non-blocking notes for the code reviewer: criterion 8 injection relies on WriteBatch.commit (add/set/create use it; BulkWriter or a transaction would not); TTL itself is not runnable in the emulator, the one-time command is for docs/review; "oversized context" is >30 keys (no per-value rule limit).
