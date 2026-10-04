# Nexife design layer ("quiet luxury")

Sources of truth: `Materials/DESIGN.md` (tokens and rules) and `Materials/code.html`
(the Branches mockup). The **Branches page** (`app/(app)/branches`) is the reference
implementation. Match it when you build new pages.

## Tokens (`app/globals.css` → Tailwind 4 `@theme`)

| Kind        | Utilities                                                                 |
| ----------- | ------------------------------------------------------------------------- |
| Surfaces    | `bg-background`, `bg-surface`, `bg-surface-container-{lowest,low,…}`      |
| Text        | `text-on-surface` (charcoal), `text-secondary`, `text-on-surface-variant` |
| Gold        | `bg-primary` (deep gold CTA), `bg-primary-container` (champagne), `text-primary` |
| Status      | `bg-success-container`, `bg-warning-container`, `bg-error-container` (+ `text-on-…`) |
| Type        | `font-headline` (Manrope), `font-sans` (Plus Jakarta Sans); `text-display-lg`, `text-headline-{lg,md,sm}`, `text-body-{lg,md,sm}`, `text-label-{md,sm}`, `eyebrow` |
| Shape       | `rounded-card` (1.5rem), `rounded-control` (1rem), `rounded-smart` (AI blocks), `rounded-full` (pills) |
| Depth       | `shadow-card` (ambient 4%), `shadow-raised` (hover)                       |
| Layout      | `gap-gutter`, `px-page`, `w-sidebar`, `h-topbar`, `max-w-content`         |

Note: the mockup's inline Tailwind config shrinks the radii (`xl` = 0.75rem). We follow
**DESIGN.md** instead (cards 1.5rem, controls 1rem), which is where the "large friendly
radii" brief comes from.

## Primitives (`components/ui`)

- `Button` / `ButtonLink`, from highest to lowest intent: `primary` (deep gold, one per view)
  → `accent` (champagne, used for AI) → `secondary` (charcoal hairline) → `ghost` (gold text)
- `Card`, `CardHeader`, `SmartBlock` (glass card with a gold left rail for AI insights)
- `Badge`: pill tones `success | neutral | gold | warning | error`. Use them sparingly.
- `PageHeader` (title + description + actions + meta chips), `PageSection`
- `SearchField`, `Field` / `Input` / `Select` (off-white fill, gold border on focus)
- `StatTile` (Manrope KPI), `TableShell`, `EmptyState`, `Skeleton`, `Avatar`, `Icon`

## Shell (`components/layout`)

`AppShell` contains:
- `Sidebar`: fixed 16rem; gold left rail on the active item; champagne "AI Style Studio"
  feature button; becomes a drawer below `lg`.
- `Topbar`: glass, holds the search pill, notifications/help, and the profile with sign-out.
- A fluid content area capped at 90rem.

Nav items are filtered by the RBAC menus the server returns.

## Rules of thumb

- Whitespace over density. Card padding is 24–32px.
- At most one `primary` button per view. Gold signals intent and AI, so don't use it as decoration.
- Headlines use Manrope; everything else uses Plus Jakarta Sans. Labels are uppercase with wide tracking (`eyebrow`).
- Icons are inline SVG (`components/ui/icon.tsx`, 1.5 stroke), so there's no icon font download.
