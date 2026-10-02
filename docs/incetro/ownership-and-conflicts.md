# Ownership and conflicts

Every Incetro-managed destination is stored with source, destination, SHA-256, owner `incetro`, and the Incetro version that wrote it.

## Unchanged owned file

`update` may replace the file when the overlay copy changed. The recorded hash matches the file, so the write is safe.

## Local edit of an Incetro rule

```text
Incetro-managed file was modified locally:
.cursor/rules/incetro-engineering.mdc
```

`update` and `remove --yes` stop with exit code 4. The file stays as you left it.

```bash
incetro-ecc update --keep-local
incetro-ecc update --accept-incetro
```

`--keep-local` refreshes other files and leaves the edit. `--accept-incetro` replaces the edit with the overlay.

## Name collision

If `.cursor/rules/incetro-engineering.mdc` exists before Incetro owns it, init stops with exit code 3. The diff status is `conflicting` and the message names that file. The existing file is not overwritten. Rename it or remove it, then init again. The same stop happens when ECC install-state already owns the destination.

## Deleted owned file

`diff` reports `missing`. `update` copies the overlay file back. `doctor` reports an unhealthy install until the file returns.

## After update

`diff` should show `up-to-date` for owned files that match the overlay. Project files such as `AGENTS.md` and `.cursor/rules/life-os-agent.mdc` are not listed as Incetro operations and are not written.

## Remove

`remove --yes` deletes a file only when its current hash equals the recorded hash, or when you pass `--accept-incetro`. Unknown files and project-owned files are not deletion candidates.
