# ADR-004: Works/editions catalog with lazy persistence

Status: Accepted

## Context

Goodreads-style catalogs suffer from duplicate editions and junk entries. Open Library already models works and editions.

## Decision

Model books as Work (the idea) and Edition (a printing). Search and book pages work at work level. Read Open Library through a Postgres-backed cache. Persist a work, edition and authors only when a user adds the book (or an admin approves a manual book).

## Consequences

- The local catalog stays small and clean.
- Work pages can render books that are not in our database, reading through the cache.
- Switching edition converts reading progress (`Progress.convertTo`).
