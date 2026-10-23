# Incetro Dev OS changelog

This changelog tracks the Incetro layer only. ECC upstream releases stay in the repository `CHANGELOG.md`.

## 1.1.0

- Introduce the Incetro living documentation rule, documentation skill and independent docs reviewer in the inherited core profile.
- Establish the proposed semantic `flat-square` badge palette, minimal GitHub-native style and non-decorative Markdown policy.
- Align Incetro copy guidance with Russian punctuation: en dash `–` for clauses and ranges, hyphen `-` for compounds and technical syntax; disallow em dash `—` in prose.
- Add a dependency-free docs checker and opt-in GitHub Actions example without taking ownership of project files.
- Document honest CI activation boundaries and include documentation tests.

## 1.0.0

- Add the `incetro-ecc` CLI for Cursor projects.
- Install ECC through the upstream selective installer and apply an Incetro-owned overlay.
- Track owned files, drift, and conflicts in `.incetro-ecc/state.json`.
- Add profiles: core, python, django, flutter, ios, go, and web.
