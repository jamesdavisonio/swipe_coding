# web-threads B6 — fresh-context review (claude-opus, fresh context)

VERDICT: shippable

PROPORTIONALITY:

- Lines added: app 412 (62 deleted, net +350, 15 files under packages/web/src) / tests 0 after the red checkpoint (1583 lines in 1174a7d: 7 test files, 2 fixtures)
- Duplicated helpers: none introduced; two removed (useReturnFocus replaces DecisionSheet's inline focus restore; logMilestone replaces use-step-ticks' inline milestone)
- Harness files added: none

Verified against code: reopenTask (guard on stage done via transitionTask; previous stage from the task's own chain; after_deploy need; doneAt null; reopenedAt from the transaction timestamp; appendLog with archive overflow; kind reopen comment; afterDone untouched; blank note writes nothing; note cap 4000 − "Reopened: " matches the B4 change-request precedent and the frozen emulator bounds). Time formatter is a fixed English month array with device-local getters, no Intl/toLocale anywhere in packages/web/src; relativeTime unchanged in output. History sheet ordering, who labels, empty copy, archive on demand with loading/error/Retry, Reopen task only while done; stacked Reopen over History coherent. No navigation when already on the thread. Derived "Reopened by you" line. Done-card buttons are siblings of the link with label-in-name names. Shared changes do not regress B4/B5 (suites pass). Logging conforms. Anti-gaming checklist clean.

Evidence: npm test 40 files / 448; test:rules 14 files / 111; typecheck clean; lint clean; build ok; contrast 38 pairs.

Minor follow-ups (not blocking): 1 failed archive read logs a message with the task-specific path (pass a stable label); 2 use-queue-task.ts still builds milestone_reached inline (could use logMilestone); 3 a note typed in a stacked Reopen sheet is lost if the task is reopened elsewhere; 4 mergeMessages' `pending` parameter now also carries derived lines (rename or comment); 5 reopenLine's `back === null` branch is unreachable.
