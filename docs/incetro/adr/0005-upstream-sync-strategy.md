# ADR 0005: Upstream sync strategy

## Status

Accepted

## Decision

Upstream ECC is a Git remote, `https://github.com/affaan-m/ECC.git`, not a copied `upstream/` directory. Sync runs on a branch, merges `upstream/main`, runs `npm test`, and opens a pull request. Tags for this layer use the prefix `incetro-v` so they do not start the upstream `v*` release workflow.

The sync job must not `git reset --hard` onto upstream and must not force-push `main`.

## Consequences

Incetro commits remain in history when Mustafa publishes. Conflicts stop the automation for a human to resolve.
