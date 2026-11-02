# 2. Design system: tokens + shadcn-style primitives on Radix, Tailwind 4

Date: 2026-11-02

## Status

Accepted

## Context

The web app is being rebuilt from the Phase 1 pages to the agreed phone-first prototype
(threads home, decision sheet, projects, stage stepper, delivery ticks). Phase 1 styled
everything with ad-hoc Tailwind `slate`/`sky` classes and four helper classes in
`index.css`; there was no palette, no dark-mode contract, no accessibility baseline, and
the prototype's semantics ("needs James", "done", "mine") had no names in code.

Constraints: single owner, phone first, English only, Tailwind 4 (CSS-first, no
`tailwind.config.ts`), a CSP without `unsafe-inline` and with `style-src`/`font-src`
limited to `'self'`.

## Decision

- **Tokens** as CSS custom properties (HSL triplets) in `packages/web/src/styles/tokens.css`,
  light in `:root`, dark in `.dark`, mapped to Tailwind utilities with `@theme inline`.
  The palette and scales are the prototype's, including three semantic status colours
  `needs`, `ok`, `me` alongside `primary`.
- **Components** in the shadcn/ui style — vendored files we own under
  `packages/web/src/components/ui/`, Radix primitives underneath where interaction matters
  (`sheet` = Radix Dialog as a bottom sheet; `label`; `slot` for `asChild`), `cva` for
  variants, `cn()` for merging. Starter set: button, input/textarea, label, card, badge,
  sheet. No shadcn CLI, no second component library.
- **Dark mode**: class on `<html>` set by `src/lib/theme.ts` from `prefers-color-scheme`,
  overridable by a saved choice.
- **Accessibility**: WCAG AA. `eslint-plugin-jsx-a11y` recommended rules,
  `scripts/check-contrast.mjs` over all token pairs in both themes (CI step),
  `docs/security/A11Y_CHECKLIST.md`.
- **Icons**: `lucide-react` re-exported from `src/lib/icons.ts`; direct imports are a lint
  error.
- **Font**: Manrope self-hosted via `@fontsource-variable/manrope` so the CSP stays
  `style-src 'self'; font-src 'self' data:`.
- **i18n**: none. Recorded in the profile so `check` does not demand keys.
- **Motion**: CSS only, durations as tokens, zeroed under `prefers-reduced-motion`.
- **No catalog** (Storybook/Ladle); the prototype is the visual reference.

## Consequences

- Every later UI change references tokens; adding a colour means adding a token in both
  themes and a contrast pair. `change-ui` owns cosmetic changes, `implement-feature`
  behaviour.
- Phase 1 pages keep working through token-based legacy helper classes (`.card`, `.btn-*`,
  `.input`, `.pill`) that are deleted as the rebuild replaces their callers.
- The CSP is unchanged: no Google Fonts, no inline styles.
- Dependencies added to `packages/web`: `@radix-ui/react-dialog`, `@radix-ui/react-label`,
  `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`,
  `lucide-react`, `@fontsource-variable/manrope`; dev: `eslint-plugin-jsx-a11y`.
