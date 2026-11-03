// One request id per operation (docs/logging.md): `web-<ulid>` for an action in the PWA.
// A ULID is 48 bits of millisecond time then 80 random bits, Crockford base32, 26 characters.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const TIME_CHARS = 10
const RANDOM_CHARS = 16
const BASE = CROCKFORD.length

function timePart(at: number): string {
  let rest = at
  let out = ''
  for (let i = 0; i < TIME_CHARS; i++) {
    out = CROCKFORD[rest % BASE] + out
    rest = Math.floor(rest / BASE)
  }
  return out
}

function randomPart(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_CHARS))
  return Array.from(bytes, (b) => CROCKFORD[b % BASE]).join('')
}

export const newRequestId = (at = Date.now()): string => `web-${timePart(at)}${randomPart()}`
