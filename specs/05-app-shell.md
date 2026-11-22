# SPEC 05 — Authenticated app shell (M1.6)

> **Status:** Implemented
> **Depends on:** SPEC 02, SPEC 03
> **Date:** 2026-11-21
> **Objective:** Build the `AppShell` component (desktop top bar, mobile top bar plus bottom tab bar, avatar menu, bell placeholder, waking-server banner) and a dev demo page that shows it, without auth or real routes.

## Why this spec exists

M1.6 runs before auth (M2) and before most screens exist. The shell therefore takes the user as a prop and is not yet mounted in a real `(app)/layout.tsx`. M2 mounts it and feeds it the session. The banner reuses the waking state already built in `lib/waking-state.ts` (SPEC 02).

## Scope

**In:**

- `apps/web/src/components/shell/AppShell.tsx`: wraps `children` with top bar, optional banner, and bottom tab bar.
- `TopBar.tsx`: wordmark (links to `/home`), center nav (Home, Library, Stats; active item has a 1 px brass underline), right side with search icon button (links to `/search`), bell button, avatar menu. Below 768 px only wordmark, search and bell show.
- `BottomTabBar.tsx`: visible below 768 px; Home, Library, Search, Stats, Profile; thin line icon plus label; active tab in wine with a brass dot; respects `env(safe-area-inset-bottom)`.
- `AvatarMenu.tsx`: dropdown with Profile, Settings, Admin (only when `role === 'ADMIN'`) and Sign out (callback).
- `WakingBanner.tsx`: reads `useWakingState()`; shows "Waking up the server. This can take up to a minute." when `waking`.
- Bell is a placeholder: icon button with accessible label, no count, no dropdown.
- Missing icons added to `components/ui/icons.tsx` (home, library, search, stats, user, bell, settings, sign-out) if not present.
- `shell` namespace in `packages/i18n` `en.json` and `es.json` for every label.
- Dev demo page `apps/web/src/app/dev/shell/page.tsx` (404 in production, same guard as `/dev/components`) rendering `AppShell` with a fake user and a toggle to simulate admin and waking state.
- Component tests for `WakingBanner` and `AvatarMenu` (Admin item only for admin).

**Out of scope (for future specs):**

- `(app)/layout.tsx`, session guard, real user data (M2.1, M2.4).
- Functional search field, quick results, ⌘K (M3.4). Here search is a link button.
- Notification dropdown, unread count, `/notifications` page (M9.2).
- Real Sign out call (M2).
- The target pages (`/home`, `/library`, `/stats`, `/search`, profile). Links may 404 until their milestones.
- PWA install banner, notch handling beyond safe-area padding (F1.5 P1, P3).

## Data model

This feature introduces no data and no API. Prop contract (local to `apps/web`):

```ts
type ShellUser = {
  name: string;
  username: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
};

type AppShellProps = {
  user: ShellUser;
  onSignOut(): void;
  children: React.ReactNode;
};
```

Conventions:

- Breakpoint: mobile below 768 px, switched with Tailwind `md:`. Content max width 1200 px, centered.
- Nav items: `/home`, `/library`, `/stats`, `/search`, `/u/{username}` (Profile). Active state from `usePathname()` prefix match.
- Avatar falls back to initials on a token-colored circle when `avatarUrl` is null.
- Colors, radii and type from tokens only. No emojis. Touch targets at least 44 px.

## Implementation plan

1. Add missing icons to `components/ui/icons.tsx` and the `shell` keys to `en.json` and `es.json`. Verify: `pnpm --filter @verso/i18n test` (catalog parity test) and typecheck.
2. Implement `WakingBanner` and its test. Verify: test passes.
3. Implement `AvatarMenu` (DropdownMenu, Admin gating, initials fallback) and its test.
4. Implement `TopBar` (desktop nav, mobile reduced) and `BottomTabBar`.
5. Implement `AppShell` composing banner, top bar, `main`, tab bar (bottom padding on mobile so content clears the tab bar).
6. Add `/dev/shell` demo page with admin and waking toggles. Verify in browser: light and dark, 375, 768 and 1280 px, EN and ES.
7. Tick M1.6 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [x] At 1280 px the top bar shows wordmark, Home, Library, Stats, search button, bell and avatar; no bottom tab bar.
- [x] At 375 px the top bar shows only wordmark, search and bell; the bottom tab bar shows Home, Library, Search, Stats, Profile.
- [x] The active nav item is underlined in brass on desktop and wine with a brass dot in the tab bar, and has `aria-current="page"`.
- [x] Wordmark links to `/home`.
- [x] Avatar menu opens with keyboard (Enter/Space), closes with Esc, and lists Profile, Settings, Sign out; Admin appears only when `role` is `ADMIN`.
- [x] Sign out item calls `onSignOut`.
- [x] Bell and search buttons have accessible names; icon-only buttons are the only unlabeled-visually controls.
- [x] `WakingBanner` renders the message when `useWakingState()` is `waking` and renders nothing when `idle`; it has `role="status"`.
- [x] Tab bar has `padding-bottom: env(safe-area-inset-bottom)`; page content is not hidden behind it.
- [x] Every label comes from `packages/i18n`; no hardcoded user-facing strings outside the demo page.
- [x] No raw hex colors; tokens only.
- [x] All controls are keyboard reachable with a visible 2 px brass focus ring; animation respects `prefers-reduced-motion`.
- [x] `/dev/shell` renders in development and returns 404 in a production build.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] The M1.6 checkbox in `ROADMAP.md` is ticked in the same PR.

### UI states: AppShell

- [ ] **Normal:** top bar, content and (mobile) tab bar render with the fake user.
- [ ] **Loading:** N/A, the shell receives an already-resolved user; M2 decides the session-loading UI.
- [ ] **Empty:** N/A, the shell has no data list. Avatar without image shows initials.
- [ ] **Error:** N/A, no failure mode of its own. Server unreachable is shown by `WakingBanner`.
- [ ] **Light theme:** all states legible and use theme tokens.
- [ ] **Dark theme:** all states legible and use theme tokens.
- [ ] **Mobile:** works at 375 px with Spanish labels, no horizontal scroll.
- [ ] **Desktop:** works at 1280 px, content centered at max 1200 px.

## Decisions

- **Yes:** `AppShell` takes `user` as a prop and is not mounted in `(app)/layout.tsx` yet. No auth exists; mounting it now would expose a fake user on real routes.
- **Yes:** demo at `/dev/shell`, same pattern as `/dev/components`. Gives the M1 "Done when" a place to look at the shell.
- **Yes:** search is a link button to `/search` for now. The real field and ⌘K are M3.4.
- **Yes:** shell code lives in `components/shell/`, since it is layout, not a reusable Verso widget.
- **Yes:** `WakingBanner` reuses `useWakingState()`; no new state logic.
- **No:** unread count or dropdown on the bell. Needs the Notification model (M9.2).
- **No:** auto-hiding top bar on scroll. Not in DESIGN.md.
- **Yes:** quick definition without detailed clarification questions (requested "short"). Layout and copy come from DESIGN.md (Web navigation, Responsive, Mobile as a PWA) and ARCHITECTURE.md (Cold starts, apps/web layout); the `/dev/shell` route and `components/shell/` location are mine and unconfirmed.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Links to routes that do not exist yet 404 | Accepted; pages arrive in M3 to M5. Demo page notes it |
| Tab bar overlaps content or the iOS home indicator | `padding-bottom` on `main` and `env(safe-area-inset-bottom)` on the bar; check at 375 px |
| Waking banner shifts layout when it appears | Banner is `position: sticky` under the top bar or overlays with fixed height reserved; verify no jump |

## What is **not** in this spec

- Auth, session guard or `(app)/layout.tsx`.
- Working search field, quick results or ⌘K.
- Notification dropdown, count or page.
- Real target pages for the nav links.
- PWA install banner and F1.5 mobile patterns.
