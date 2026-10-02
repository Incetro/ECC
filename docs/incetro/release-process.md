# Release process

Incetro versions and ECC versions are different numbers.

```text
ECC upstream: 2.2.3     package.json
Incetro layer: 1.0.0    incetro/VERSION
```

## Tag

Use:

```text
incetro-v1.0.0
```

Do not tag Incetro-only releases as `v1.0.0`. The upstream release workflow listens for `v*` and publishes `ecc-universal`. An `incetro-v*` tag does not match that filter.

## Steps

1. Update `incetro/CHANGELOG.md`.
2. Set `incetro/VERSION` to the SemVer you are shipping.
3. Run `node tests/incetro/run.js --e2e`.
4. Merge to `main`.
5. Tag `incetro-vX.Y.Z` on that commit and push the tag.

Projects install that commit with:

```bash
incetro-ecc self-update
incetro-ecc update
```

`self-update` tracks the default branch of `Incetro/ECC`, not an individual tag. Tagging marks the release. The global install command in this version follows `main`.

## Changelog

Keep Incetro notes in `incetro/CHANGELOG.md`. Leave the upstream `CHANGELOG.md` for ECC releases.
