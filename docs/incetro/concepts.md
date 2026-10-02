# Concepts

## ECC

ECC is the upstream agent operating system from Affaan Mustafa. Incetro ECC installs it with the existing selective installer, install-state, doctor, and uninstall. Incetro does not keep a second copy of those mechanisms.

## Incetro layer

The Incetro layer is the `incetro/` directory in this repository: rules, agents, skills, and profiles. It has its own SemVer in `incetro/VERSION`. That version is independent from the ECC version in `package.json`.

## Project layer

Files a team creates in its own repository are project-owned. Examples:

```text
.cursor/rules/life-os-agent.mdc
AGENTS.md
docs/
```

The installer does not modify them unless a path is already recorded as Incetro-owned.

Instruction priority, when an agent has to choose which guidance to follow:

```text
Project > Incetro > ECC
```

That priority does not rewrite upstream ECC files. It tells agents which instructions win.

## Profile

A profile is a JSON document that names an ECC profile, ECC skills, and Incetro component ids. It does not copy component bodies. See [profiles.md](profiles.md).

## Owned file

An Incetro-owned file is recorded in `.incetro-ecc/state.json` with its source, destination, and SHA-256. ECC-owned files are recorded in ECC install-state. Everything else is project-owned.

## Drift

Drift means an owned file changed after install. The working tree hash no longer matches the hash in state. Update and remove refuse to overwrite or delete that file until you pass `--keep-local` or `--accept-incetro`.

## Conflict

A conflict means the destination already exists and Incetro does not own it, or ECC already owns that path. The installer leaves the file in place.
