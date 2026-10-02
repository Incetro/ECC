# Adding rules, agents, and skills

The installer is data-driven. A new component does not need a new branch in JavaScript.

## Rule

Create `incetro/rules/<id>.mdc`. Use an `incetro-` prefix.

Register the id in a profile:

```json
"incetro": { "rules": ["incetro-engineering"] }
```

## Agent

Create `incetro/agents/<id>.md` with `name` and `description` frontmatter.

Register the id in `incetro.agents`.

## Skill

Create `incetro/skills/<id>/SKILL.md`.

Register the id in `incetro.skills`.

## Test

```bash
node tests/incetro/run.js
```

Profile inheritance and filesystem discovery are covered by `tests/incetro/profiles.test.js`. A temporary overlay in that test installs a rule that is not hardcoded in the installer.

## Release

1. Add a note to `incetro/CHANGELOG.md`.
2. Bump `incetro/VERSION` when the overlay should ship as a new Incetro version.
3. Tag `incetro-vX.Y.Z`. Do not use a `v*` tag. Those tags start the upstream ECC release workflow.
4. Projects pick it up with:

```bash
incetro-ecc self-update
incetro-ecc update
```
