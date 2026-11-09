// What the ports that run an executable (launcher.ts: `claude`, github.ts: `gh`) make of a child
// process that failed: an Error with a `code` the notifier stores as the status of its
// api_call_failed warning (exit_<n>, timeout, ...), and the last line it printed.

export class CodedError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = new.target.name
    this.code = code
  }
}

// The last non-blank line of `text`, trimmed.
export const lastLine = (text: string): string | undefined =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .pop()
