# Getting started

## Install

Requires Node.js 20 or newer and Git.

```bash
npm install -g git+https://github.com/Incetro/ECC.git
incetro-ecc version
```

## Init

From the project directory:

```bash
incetro-ecc init
```

Or pass a path:

```bash
incetro-ecc init /absolute/path/project
```

The command prints the project root, installs the ECC profile selected by the Incetro profile, copies the Incetro overlay, and writes `.incetro-ecc/state.json`.

A successful run looks like this:

```text
Incetro ECC initialized

Project: life-os-agent
Profile: django
ECC: 2.2.3
Incetro: 1.0.0

Installed:
23 ECC components
4 Incetro components

Existing project rules preserved: 3

Status: healthy
```

Choose a profile when detection should not decide:

```bash
incetro-ecc init --profile django
```

## Check

```bash
incetro-ecc status
incetro-ecc doctor
incetro-ecc diff
```

`diff` changes nothing. Run it before `update`.

## Update the project

```bash
incetro-ecc update
```

This refreshes the current project. It does not download a new CLI. To update the CLI, run `incetro-ecc self-update` first. See [updating.md](updating.md).
