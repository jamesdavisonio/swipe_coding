## Decision brief (round)

### Where it came from

The test checker found a new way round the logs tests in round 2, so the automatic rounds stopped and it comes to you.

### Why it exists

The agent may store at most 20 failures in any 60 seconds. Each fixed test catches one cheat, then a slightly shifted cheat slips past.

### What will change

One more test that catches every shifted variant at once: 20 failures spread three seconds apart, then one more that must be refused. The checker modelled it, and every cheat fails.

### Key assumptions

Only the per-minute cap is open. The other eleven criteria have passed.

### Out of scope

Any change to the spec or the cap, and any other test.

### What you're agreeing to

One more automatic round on this test. If it still won't close, it comes back to you.

Reply "another round", or tell me what to change.
