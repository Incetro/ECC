# Commands

Global options for every command:

```text
--json       one JSON object on stdout
--verbose    paths and ECC warnings
--help       command list and exit codes
```

Exit codes:

```text
0  success
1  generic failure
2  invalid configuration
3  conflicts detected
4  drift detected
5  unhealthy installation
```

Paths are accepted by `init`, `update`, `status`, `doctor`, `diff`, and `remove`:

```bash
incetro-ecc init .
incetro-ecc init ../project
incetro-ecc init /absolute/path/project
```

An explicit path is the project root. The tool does not walk above it.

## init

```bash
incetro-ecc init [path] [--profile <id>]
```

Installs ECC and the Incetro overlay. Writes `.incetro-ecc/state.json`.

Changes: ECC-managed files, new Incetro-owned files, Incetro state.

Never changes: project-owned files, drifted or conflicting destinations. A second init changes nothing.

Exit 0 when the project is healthy or already initialized. Exit 3 on conflict. Exit 5 when doctor is unhealthy.

## update

```bash
incetro-ecc update [path] [--keep-local | --accept-incetro]
```

Refreshes the current project.

- No flag: stop before writes when drift or conflicts exist.
- `--keep-local`: leave drifted files in place and refresh the rest.
- `--accept-incetro`: replace drifted Incetro files with the overlay, and allow ECC to refresh drifted ECC-managed files.

Changes: ECC-managed files that are safe to refresh, Incetro files selected by the flags, state.

Never changes: project-owned files, conflicting paths, drifted files unless `--accept-incetro` is set.

## status

```bash
incetro-ecc status [path]
```

Prints project, target, profile, versions, and health counts. Changes nothing. Exit 0 when state can be read. Exit 5 when the project is not initialized.

## doctor

```bash
incetro-ecc doctor [path]
```

Runs ECC doctor plus Incetro checks: Node.js version, Git, project root, state schema, missing files, drift, conflicts, duplicate destinations, symlinks, ECC compatibility, the Cursor directory, and stale state.

Changes nothing.

## diff

```bash
incetro-ecc diff [path]
```

Read-only report of `up-to-date`, `outdated`, `drifted`, `missing`, `conflicting`, and `new`.

Exit 0 when those problem counts are zero. Exit 3 for conflicts, 4 for drift, 5 for missing owned files.

## remove

```bash
incetro-ecc remove [path] --dry-run
incetro-ecc remove [path] --yes
incetro-ecc remove [path] --yes --keep-local
incetro-ecc remove [path] --yes --accept-incetro
```

Without `--yes`, the command prints a plan and deletes nothing. `--dry-run` does the same.

`--yes` deletes Incetro-owned files whose bytes still match state, then uninstalls ECC-managed files through the ECC uninstaller. Project-owned files stay. Drifted Incetro files stay unless `--accept-incetro` is set. `--keep-local` deletes unchanged owned files and leaves local edits on disk.

`.incetro-ecc.json` is project configuration and is not deleted.

## self-update

```bash
incetro-ecc self-update
```

For a global npm install, runs:

```bash
npm install -g git+https://github.com/Incetro/ECC.git
```

A source checkout prints that command instead of pulling Git. A permission failure prints the same command and exits 1.

Changes: the global CLI install. Never changes the current project.

## version

```bash
incetro-ecc version
```

Prints the Incetro layer version and the ECC package version. Changes nothing.

## help

```bash
incetro-ecc help
```

Prints usage and exit codes. Changes nothing.
