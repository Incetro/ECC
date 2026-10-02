# FAQ

## Does init copy ECC by hand?

No. Init calls the ECC selective installer through `ecc-adapter.js`.

## Can I run init twice?

Yes. The second run leaves files and state as they are and tells you to use `update`.

## Will update delete my AGENTS.md?

No. Paths that are not recorded as Incetro-owned or ECC-owned stay in the project.

## What if I edit an Incetro rule in the project?

That is drift. Update stops until you pass `--keep-local` or `--accept-incetro`.

## How do I get Mustafa's latest ECC?

Wait for the upstream sync pull request, merge it, then `self-update` and `update` in the project. See [updating.md](updating.md).

## Which Node version?

Node.js 20 or newer. `doctor` reports an older runtime as unhealthy.

## Can the config start a script?

No. `.incetro-ecc.json` only accepts the documented keys. Other keys fail configuration checks.
