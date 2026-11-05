## Decision brief (round)

### Where it came from

Round 3 closed the shifted-reset cheats, but the checker found one more: a counter built from small clock-aligned buckets.

### Why it exists

Every timing check in the test starts exactly on a whole minute, so a bucketed counter lines up with it and passes.

### What will change

The trickle test starts half a second before the minute instead. One line. The checker modelled it: every remaining cheat fails, and a true rolling window still passes.

### Key assumptions

This is the fourth and last automatic round. If it finds yet another variant, I freeze the tests and leave the cap to the code reviewer.

### Out of scope

Any change to the spec, the cap, or any other test.

### What you're agreeing to

One last round on this test, then the build starts.

Reply "another round", or tell me what to change.
