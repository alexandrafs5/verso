# ADR-006: Three-level visibility with inheritance

Status: Accepted

## Context

Users want fine-grained privacy for annotations and notes, but also simple defaults.

## Decision

Visibility is PUBLIC or PRIVATE with an INHERIT value. Resolution walks up: item, parent annotation (for notes), UserBook `annotationVisibility`, user `defaultAnnotationVisibility`. The user level is never INHERIT. Profile access rules live in `ProfileAccessPolicy`.

## Consequences

- Every read of another user's content must go through `VisibilityResolver` / `ProfileAccessPolicy`.
- All inheritance paths and access rules need unit and integration tests.
- Hidden books never show to others, including their annotations and reviews.
