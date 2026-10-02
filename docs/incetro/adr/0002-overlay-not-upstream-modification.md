# ADR 0002: Overlay, not an upstream rewrite

## Status

Accepted

## Decision

Incetro files live in `incetro/`, `scripts/incetro/`, `tests/incetro/`, and `docs/incetro/`. Upstream ECC trees (`agents/`, `skills/`, `rules/`, installer scripts) stay unmodified except for the `package.json` bin and publish list required to expose the CLI.

## Consequences

Upstream merges rarely touch Incetro files. Branding does not fork the ECC README. `INCETRO.md` is the root entry point.
