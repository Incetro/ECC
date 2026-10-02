# Incetro overlay

This directory is the Incetro-owned layer. It is not a fork of ECC content.

Profiles in `profiles/` reference component ids. The installer discovers rules, agents, and skills from the filesystem. Adding a component does not require a JavaScript change:

1. Add the file under `rules/`, `agents/`, or `skills/<id>/`.
2. Reference its id from a profile, or from a project's `include` list.

See `docs/incetro/adding-rules-agents-skills.md`.
