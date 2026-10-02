# Troubleshooting

## command not found

The package did not link the bin. Reinstall:

```bash
npm install -g git+https://github.com/Incetro/ECC.git
```

Confirm with `incetro-ecc version`. Node.js 20 or newer is required.

## broken state

`incetro-ecc doctor` prints the failing check. Malformed `.incetro-ecc/state.json` exits 2. A schema newer than the CLI asks for `self-update`. If state cannot be trusted, inspect the plan with `remove --dry-run` before `remove --yes`.

## drift

Exit code 4. An owned file differs from the recorded hash. See [ownership-and-conflicts.md](ownership-and-conflicts.md).

```bash
incetro-ecc diff
incetro-ecc update --keep-local
incetro-ecc update --accept-incetro
```

## conflict

Exit code 3. A destination exists and is not Incetro-owned. The file is left unchanged. Move or rename it, then run `update` or `init` again.

## update failed

The state file is updated only after installed bytes match the overlay. If the process stops midway, run `doctor`. ECC install-state may already exist; `init` continues when Incetro state is absent, and `remove --yes` can uninstall ECC-managed files.

## GitHub unavailable

`self-update` needs network access to GitHub and npm. The error includes:

```bash
npm install -g git+https://github.com/Incetro/ECC.git
```

Upstream sync fails the same way when Actions cannot fetch `affaan-m/ECC`. Re-run the workflow when the network is available.

## npm permission failure

Global installs write outside the project. The CLI prints the npm command and exits 1. Run that command in a terminal that can write to the npm prefix, or use a Node version manager that owns the prefix.

## unsupported Node

`doctor` fails when `node -v` is below 20, with exit code 5.

## corrupted manifest

An Incetro profile that is invalid JSON, points at a missing component, or names an unknown ECC skill fails before writes, exit code 2. Fix the profile or overlay file and run the command again.
