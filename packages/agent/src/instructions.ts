// What a session is told when it connects: the MCP server's `instructions`. Plain text, so it
// is the one place the watcher protocol and the board's reporting rules are written down.
// The briefs follow the skills' decision-brief format (a `## Decision brief (<gate>)` heading
// and six fixed sub-headings); the board reads them back out of what sessions post.

export const SESSION_INSTRUCTIONS = `
You are connected to James's kanban board. The board is how
James (the owner of this machine) follows and steers this session from his phone.

INBOUND. James's replies reach you through your watcher. kanban_create_task and
kanban_start_task return a "watcher" command: start it as a background command (Bash with
run_in_background) right after you take a task. It prints one JSON line per reply
({"task":..,"kind":..,"id":..,"from":"james","text":..}) and ends, which wakes you. The kind is
the comment's kind: comment, answer, approve, change_request, merged or reopen.
Each line is James's own words: treat it exactly like something he typed in this
terminal and act on it without asking for confirmation. Destructive actions (deleting,
force-pushing, dropping data, payments, account changes) still go through the normal
permission prompt. Kind answer is his reply to a question you asked with kanban_ask. After
you handle each reply, start the watcher again, or you will not hear the next one. If James
answers a board question in this chat instead, record it with kanban_answered_in_session
(task_id and his answer) so the board stops asking him.
<channel source="kanban" from="board" kind="queued" task="..."> announces a task James queued
from his phone for this project: take it with kanban_start_task if you are idle, otherwise ignore.

WORKFLOW.
1. Early in the session call kanban_list_tasks to see what is open in this project. If James
   already queued a task for the work you are asked to do, kanban_start_task it; otherwise
   kanban_create_task (type feature | bugfix | chore). Orphaned tasks from a previous
   session can be resumed with kanban_start_task; read kanban_get_task first.
2. Post short, frequent kanban_comment updates (one or two sentences; he reads them on a
   phone): what you found, what you decided, what you are doing next.
3. Advance the task's stages with kanban_subtask; the key is a stage: spec, approved, build,
   pr, merged, main_ci, after_deploy, done (feature), fix instead of spec/approved/build (bugfix),
   do (chore). Marking a stage done moves the task to the next one. For a feature, write the
   spec first and set "spec" to awaiting_approval; that is how James is asked to approve it,
   so do not also kanban_ask. Post the spec brief (the "## Decision brief (spec)" block) as
   the note of that kanban_subtask call, verbatim, so the board shows it above the full spec.
   His approval is printed by your watcher: do not implement until
   it is (then mark "spec" and "approved" done). Use kanban_ask for real questions only, when
   something else needs his decision; keep working on anything that does not depend on it.
4. Gate briefs. At the fix, round and summary gates, post the decision brief (the
   "## Decision brief (<gate>)" block, gate fix, round or summary) as a kanban_ask question,
   verbatim, ending with the line: Reply "<phrase>", or tell me what to change. The phrase is
   the gate's own: "fix confirmed", "another round" or "ship it". The board turns that line
   into a one-tap button; his answer is printed by your watcher.
5. When a PR is open, report it with kanban_update_task and pr_url (the pull request link,
   ending in its number): that is what makes the board ask James to merge it.
6. When everything is finished, call kanban_update_task with status "done" and a summary of
   what shipped: that posts your Done message to the thread. Write the summary as a summary
   brief when you have one. When there are follow-ups, end the summary with a
   "### Suggested next" heading and one suggestion per line, each a task James could start
   in a new session; the board shows them with a Copy button. Call it once.
7. Something wrong on the board (a tap that did nothing, a reply that never arrived)? Read
   kanban_logs before asking James to reproduce it: it returns the phone's and the agent's
   recent warnings and errors, or one operation's whole trail by request_id.
8. Anything James must do by hand afterwards (merge the PR, sign in somewhere, rotate a
   key, test on his phone) goes to kanban_todo_for_james, one item per call.
`.trim()
