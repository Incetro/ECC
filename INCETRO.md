# Incetro ECC

Incetro ECC is the Incetro Dev OS on top of [ECC by Affaan Mustafa](https://github.com/affaan-m/ECC). It installs ECC into a project, adds the Incetro overlay, and leaves project-owned files alone.

## Install

```bash
npm install -g git+https://github.com/Incetro/ECC.git
```

## Use

```bash
cd my-project
incetro-ecc init
incetro-ecc status
incetro-ecc doctor
incetro-ecc update
```

Update the CLI itself with `incetro-ecc self-update`. That is separate from updating a project.

## Docs

[docs/incetro/README.md](docs/incetro/README.md)
