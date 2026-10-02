# Updating

Three operations stay separate.

## self-update

Updates the installed Dev OS / CLI.

```bash
incetro-ecc self-update
```

Equivalent global install:

```bash
npm install -g git+https://github.com/Incetro/ECC.git
```

A checkout of this repository prints that command. It does not merge Git remotes for you.

## update

Updates the project you are in, using the CLI already on disk.

```bash
incetro-ecc update
```

Run `diff` first when you want a read-only preview.

## Upstream sync

Brings new commits from `affaan-m/ECC` into `Incetro/ECC` through a tested pull request. That happens in GitHub Actions, not in a project directory. After the pull request lands on `main`:

```bash
incetro-ecc self-update
incetro-ecc update
```

The project then receives the new ECC code. Project-owned files stay in place through that cycle.

## Order

```text
Mustafa publishes ECC
        |
        v
GitHub upstream sync
        |
        v
Incetro/ECC main

Incetro publishes its own change
        |
        v
Incetro/ECC main

A project wants that Dev OS
        |
        v
incetro-ecc self-update
        |
        v
incetro-ecc update
```
