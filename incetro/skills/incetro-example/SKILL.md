---
name: incetro-example
description: Shows how an Incetro skill is packaged and what a project should verify before finishing a change.
---

# Incetro example

Use this skill when adding another Incetro skill, or when checking that a project change is actually finished.

## Add a skill

1. Create `incetro/skills/<id>/SKILL.md`.
2. Use an `incetro-` id.
3. Reference that id from `incetro/profiles/<profile>.json` or from `.incetro-ecc.json` `include`.
4. Do not edit the installer to special-case the skill.

## Verify

- The skill directory contains `SKILL.md`.
- `incetro-ecc diff` shows the new file as `new` in a project that selects it.
- `incetro-ecc update` copies it once.
- A second update reports the file unchanged.
