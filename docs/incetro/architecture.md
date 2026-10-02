# Architecture

```text
affaan-m/ECC
      |
      | upstream sync (branch, tests, pull request)
      v
Incetro/ECC
├── ECC upstream code
├── Incetro overlay          incetro/
└── Incetro CLI              scripts/incetro/
      |
      | incetro-ecc init / update
      v
Project
├── ECC-managed files        .cursor/** recorded by ECC install-state
├── Incetro-managed files    .cursor/** recorded by .incetro-ecc/state.json
└── project-owned files      everything else
```

## Boundary

```text
Incetro CLI
     |
     v
scripts/incetro/core/ecc-adapter.js
     |
     v
ECC install / doctor / uninstall / install-state
```

Only `ecc-adapter.js` imports ECC installer modules. If an upstream release renames those exports, the adapter reports:

```text
ECC compatibility check failed.
Expected: ...
Detected: ...
```

## Lifecycle

### init

Resolve the project root, read `.incetro-ecc.json`, resolve the profile, build a dry plan, install ECC, copy Incetro files, write state, then run doctor.

A second `init` does not copy files again. It tells you to run `update`.

### update

Refresh the current project from the CLI that is already installed. Drift and conflicts are reported before writes. State is written after the file transaction verifies hashes.

### self-update

Reinstall the global CLI from `git+https://github.com/Incetro/ECC.git`. This does not edit the project.

### upstream sync

A GitHub Actions workflow fetches `affaan-m/ECC` `main`, merges it on a sync branch, runs the test suite, and opens a pull request. It does not reset `main`.

## Targets

The CLI talks to a target adapter (`scripts/incetro/targets/`). Cursor is the implemented target. A later target adds a module and a profile `target` value. Command code does not call Cursor-specific functions.

## State

`.incetro-ecc/state.json` uses `schemaVersion`. A newer schema than the CLI understands stops with a configuration error and asks for `self-update`. Older schemas are migrated by functions in `scripts/incetro/core/state.js` before validation.

## What stays out of upstream files

Incetro behavior lives in:

```text
incetro/
scripts/incetro/
scripts/incetro-ecc.js
tests/incetro/
docs/incetro/
```

`package.json` gains the `incetro-ecc` bin, the `test:incetro` script, and publish paths for those directories. The package name stays `ecc-universal`.
