# ADR-003: Same-origin API proxy through Next.js

Status: Accepted

## Context

Web and API are on different hosts (Vercel and Render) and there is no custom domain. Cross-site session cookies are blocked by Safari and other browsers.

## Decision

The browser only talks to the web origin. `next.config` rewrites `/api/:path*` to the Render API. Session cookies are first-party (`SameSite=Lax; Secure; HttpOnly`).

## Consequences

- No third-party cookie problems and no custom domain needed.
- Extra network hop on every API call.
- The proxy has request timeouts, so long work goes to background jobs.
