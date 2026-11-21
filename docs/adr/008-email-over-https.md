# ADR-008: Email over HTTPS (Brevo)

Status: Accepted

## Context

Render Free blocks outbound SMTP ports. Verification and reset emails are required.

## Decision

Send email through the Brevo HTTP API behind `EmailProvider`. Locally, use an SMTP implementation with Mailpit.

## Consequences

- Works on Render Free.
- Single verified sender address until a domain exists.
- Free limit of 300 emails/day is far above expected use.
