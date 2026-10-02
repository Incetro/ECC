# ADR 0004: ECC adapter boundary

## Status

Accepted

## Decision

`scripts/incetro/core/ecc-adapter.js` is the only module that loads ECC installer internals. It checks the exports it needs and returns a small result shape to the CLI: install, doctor, uninstall, managed paths, and versions.

## Consequences

An upstream refactor shows up as a compatibility error with the expected export and the detected failure, and as a failing contract test. The rest of the CLI keeps calling the adapter.
