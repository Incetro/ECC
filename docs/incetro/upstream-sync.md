# Upstream sync

ECC from Affaan Mustafa arrives as Git history. This fork does not vendor a second tree under `upstream/`.

## Remotes

```text
origin    https://github.com/Incetro/ECC.git
upstream  https://github.com/affaan-m/ECC.git
```

Add the upstream remote locally when you need to inspect it:

```bash
git remote add upstream https://github.com/affaan-m/ECC.git
git fetch upstream main
git log --oneline HEAD..upstream/main
```

## What runs automatically

`.github/workflows/sync-upstream.yml` runs daily and on `workflow_dispatch`.

```text
fetch affaan-m/ECC main
        |
        no new commits? stop
        |
        v
create sync/upstream-<sha>-<run>
        |
        v
merge upstream/main
        |
        v
npm test
        |
        v
open a pull request into main
```

The workflow permissions are `contents: write` and `pull-requests: write`. It uses `GITHUB_TOKEN` only.

When the merge is clean and tests pass, the workflow tries `gh pr merge --auto`. If repository policy rejects auto-merge, the pull request stays open for one approval.

## Conflicts

The job stops when `git merge` reports conflicts. It does not commit conflict markers, reset `main`, or force-push `main`.

Resolve on a local branch:

```bash
git fetch upstream main
git checkout -b sync/upstream-manual
git merge upstream/main
```

Keep Incetro files under `incetro/`, `scripts/incetro/`, `docs/incetro/`, and `tests/incetro/`. Resolve `package.json` by keeping the `incetro-ecc` bin entry together with the upstream package metadata.

## Check the upstream commit

The pull request body includes the upstream SHA. You can also read it from the merge commit:

```bash
git log -1 --oneline upstream/main
```
