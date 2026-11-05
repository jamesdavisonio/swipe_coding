# app-logs L1 — fresh-context review 1 (claude-opus, fresh context)

VERDICT: needs-changes — one issue:

1. packages/agent/src/app-log.ts:84-89 and :125-131 — failed stores use up the per-minute budget: claimSlot pushes `now` before the write and the catch never releases it; the contract counts stored events only. Fix: release the claimed slot in the catch (storedAt.splice(storedAt.lastIndexOf(now), 1)), keep the claim synchronous before the await.

Confirmed by the reviewer: true rolling 60 s window (Date.now(), evict at >= 60 000 ms, synchronous claim); stores via collection.add (WriteBatch.commit); every failure site matches the contract table; expireAt Timestamp at ts + 30 d both sides; firestore.indexes.json: 6 existing indexes semantically identical, only addition logs (request_id ASC, ts ASC); tests unchanged since ff17581; no gaming; vitest 532/532, test:rules 227/227, typecheck and lint clean.

Non-blocking follow-ups: ambient.d.ts comment says the logger is never edited (fixed with issue 1); an `undefined` context value would make batch.set throw and drop the batch (strip undefined in boundedLogFields); a persistent registration failure stores two events per tool call (capped); hand James the TTL command and the logger template change.
