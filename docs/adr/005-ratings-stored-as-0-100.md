# ADR-005: Ratings stored as 0-100

Status: Accepted

## Context

Users prefer different rating scales: whole stars, half stars, quarter stars, 1-10 with decimals, or 1-100.

## Decision

Store every rating as an integer from 0 to 100. The display scale is a user setting. The shared `Rating` value object converts input and output, so web and API format identically.

## Consequences

- Changing the display scale needs no data migration.
- Conversions live in one tested class in `packages/shared`.
- Percentages follow the same idea: basis points, 0-10000.
