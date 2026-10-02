# ADR 0003: File ownership

## Status

Accepted

## Decision

Three owners are recorded separately.

- ECC ownership stays in ECC install-state.
- Incetro ownership stays in `.incetro-ecc/state.json` with source, destination, and SHA-256.
- Any other path is project-owned.

Writes stop on drift and on conflicts. `--keep-local` preserves local bytes. `--accept-incetro` replaces drifted Incetro bytes with the overlay. Project-owned paths are never deletion candidates.

## Consequences

Update is safe to re-run. A local edit of an Incetro rule survives until a person chooses a flag.
