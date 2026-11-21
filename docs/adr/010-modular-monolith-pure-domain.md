# ADR-010: Modular monolith with pure domain classes

Status: Accepted

## Context

The project is small, but it should show clear layering and testable business rules.

## Decision

Build one NestJS app split into modules. Each module follows controller, service, repository, with pure classes in `domain/` that import neither Nest nor Prisma. Cross-module calls go through exported services. Side effects across modules use events.

## Consequences

- Business rules (lifecycle, streaks, visibility, import mapping) are unit tested in isolation.
- No microservice overhead.
- Module boundaries must be enforced in review.
