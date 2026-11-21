# ADR-007: PWA instead of a native app

Status: Accepted

## Context

Mobile use matters, but a native app needs store accounts, fees and a second codebase.

## Decision

Ship the mobile experience as a PWA: web manifest, Serwist service worker and Web Push (VAPID). This is phase F1.5.

## Consequences

- One codebase and free distribution.
- iOS supports push only when the app is installed to the home screen. The UI shows a hint.
- No haptics on iOS. Vibration works where the browser supports it.
