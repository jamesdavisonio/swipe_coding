# Accessibility checklist (WCAG AA)

Last verified: 2026-11-02

Walk this for every new or changed component; the PR template links here. Baseline
enforced by `eslint-plugin-jsx-a11y` and `scripts/check-contrast.mjs`; the rest is review.

## Every interactive element

- [ ] Native element first (`<button>`, `<a href>`, `<input>`); ARIA role only when nothing native fits.
- [ ] Reachable and operable by keyboard alone; Tab order matches the visual order.
- [ ] Focus visible: the token ring (`outline: 2px solid hsl(var(--ring))`) or a stronger
      replacement — never `outline: none` alone.
- [ ] Accessible name: visible text, `<Label htmlFor>`, or `aria-label` (icon-only buttons).
- [ ] Target ≥ 44 × 44 px (`h-11` / `size-11`); the phone is used one-handed.
- [ ] State conveyed non-visually: `aria-pressed` (chips), `aria-expanded`, `aria-selected`,
      `aria-current` (nav), `aria-busy` (working).

## Colour and text

- [ ] Text ≥ 4.5:1, large text ≥ 3:1, UI parts ≥ 3:1 — new token pairs added to `PAIRS` in
      `scripts/check-contrast.mjs`.
- [ ] Colour never carries meaning alone: a status pill has words, a tick has a label.
- [ ] Works at 200 % zoom / largest iOS text size without clipping.

## Forms

- [ ] Every field has a label; errors use `aria-invalid` + `aria-describedby` to the message.
- [ ] Submit on Enter (or ⌘/Ctrl+Enter for multi-line) as well as the button.

## Sheets, dialogs, menus

- [ ] Built on `components/ui/sheet.tsx` (Radix): focus trapped, restored on close, Escape closes,
      `aria-modal`, title present, background inert.
- [ ] Custom overlays use `src/lib/a11y.ts` (`trapFocus`, `rememberFocus`).

## Motion and media

- [ ] Durations come from `--motion-*` tokens (zero under `prefers-reduced-motion`).
- [ ] Images: `alt=""` when decorative, a meaning (not a description) otherwise.

## Done means

- [ ] `npm run lint` clean (jsx-a11y), `node scripts/check-contrast.mjs` passes.
- [ ] Tried once with VoiceOver on the phone for anything James will tap daily.
