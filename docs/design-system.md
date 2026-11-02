# Design system

The web app's visual language, lifted from the agreed prototype (`prototype/index.html`,
interactive copy at https://claude.ai/artifact/G9eMLDsxFLp8S7bhxyC6uU). Decision record:
`docs/decisions/0002-design-system.md`.

## Where things live

| What            | Path                                            | Rule                                                                    |
| --------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Tokens          | `packages/web/src/styles/tokens.css`            | Only place a colour, radius, size or duration is defined                |
| Tailwind wiring | `packages/web/src/index.css` (`@theme`)         | Utilities like `bg-card`, `text-needs`, `rounded-md` read the tokens    |
| Components      | `packages/web/src/components/ui/`               | `button`, `input`/`textarea`, `label`, `card`, `badge`, `sheet`         |
| Helpers         | `packages/web/src/lib/{cn,icons,a11y,theme}.ts` | `cn()` merges classes; icons only via `icons.ts`; theme toggles `.dark` |
| Contrast gate   | `scripts/check-contrast.mjs`                    | Every fg/bg pair in both themes; runs in CI                             |
| Checklist       | `docs/security/A11Y_CHECKLIST.md`               | Walked per component PR                                                 |

## Tokens in one glance

| Token                | Light     | Dark      | Use                                      |
| -------------------- | --------- | --------- | ---------------------------------------- |
| `background`         | `#F5F4F0` | `#121214` | page                                     |
| `card`               | `#FFFFFF` | `#1C1C20` | rows, cards, sheets                      |
| `foreground`         | `#1A1A1D` | `#F1F1EE` | text                                     |
| `muted-foreground`   | `#606066` | `#A4A4AA` | secondary text                           |
| `muted` / `border`   | `#E3E2DC` | `#2C2C32` | lines, quiet fills                       |
| `primary` (+`-soft`) | `#1F5AE0` | `#7FA3FF` | links, "my turn" accents, accent button  |
| `needs` (+`-soft`)   | `#8F5300` | `#F2B84B` | waiting on James                         |
| `ok` (+`-soft`)      | `#1B7A45` | `#71CF98` | done, live, approve                      |
| `me`                 | `#1A1A1D` | `#F1F1EE` | James's own messages, the primary button |

Type: Manrope Variable (self-hosted), body 15px, titles 26px/800. Radii 8/12/14/20px.
Motion 120/200/320ms with `--ease-out`; zero under `prefers-reduced-motion`.
Layout: phone-first, content column `max-w-(--content-max)` (560px), safe-area padding via
`pt-safe` / `pb-safe`, 44px tap targets.

## Rules

1. No hardcoded colours, sizes or durations in components — add a token first.
2. New primitive → `components/ui/`, built on Radix where interaction is non-trivial.
3. Icons from `src/lib/icons.ts` (lint blocks direct `lucide-react` imports).
4. Dark mode is the `.dark` class; use `dark:` only for the rare case a token cannot express.
5. Status colour always travels with a word (`Badge` text, tick labels).
6. Every UI PR: lint clean, contrast gate green, A11Y checklist walked, light + dark screenshots.

## Not here (yet)

Thread rows, chips, stepper, delivery ticks, bottom nav — built by `implement-feature` per
behaviour on top of these primitives. No component catalog: the prototype is the reference.
No i18n: single owner, English.
