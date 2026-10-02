# Incetro ECC

Incetro ECC is a project installer on top of [ECC](https://github.com/affaan-m/ECC). One command prepares a repository for Cursor:

```bash
npm install -g git+https://github.com/Incetro/ECC.git
cd my-project
incetro-ecc init
```

After that, the project has three layers:

- ECC-managed files, installed by the upstream ECC installer
- Incetro-managed files, installed from the `incetro/` overlay
- Project-owned files, which the installer does not change

Read [getting-started.md](getting-started.md) for the short path. The rest of this directory explains commands, ownership, profiles, and upstream sync.
