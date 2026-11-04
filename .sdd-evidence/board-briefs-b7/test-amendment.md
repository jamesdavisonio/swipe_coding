## Decision brief (fix)

### Where it came from

The B7 builder finished with everything green except one locked test: Copy shows "Copied" for two seconds, then "Copy".

### Why it exists

The test's own clock setup is ignored. A shared helper has already faked the date, so the testing library skips the test's request to also fake timers. The two seconds never pass inside the test. I confirmed this in the library code.

### What will change

One line is added to that test, resetting the clock before it fakes the timers. The test then checks exactly what it was meant to check. No app code changes.

### Key assumptions

The builder ran the corrected test, and it passes against their code. I will re-run it myself.

### Out of scope

Any other test, and any change to the Copy behaviour.

### What you're agreeing to

A separate commit amending one frozen test, recorded in the B7 evidence.

Reply "fix confirmed", or tell me what to change.
