# Testing

## Suites

```bash
npm test
npm run test:incetro
INCETRO_E2E=1 node tests/incetro/e2e-smoke.test.js
```

`npm test` is the upstream ECC suite plus every `tests/**/*.test.js` file, including Incetro unit tests.

`npm run test:incetro` runs only `tests/incetro`. Pass `--e2e` to include the filesystem smoke test:

```bash
node tests/incetro/run.js --e2e
```

## What the unit tests cover

- CLI help, version, unknown commands, invalid arguments
- Git roots, plain directories, explicit paths, spaces, and non-ASCII paths
- init on an empty project, an existing `.cursor`, project rules, and a second init
- unchanged, drifted, colliding, and missing owned files
- update with no changes, new components, edited components, removed components, drift, and conflicts
- remove of Incetro-owned files, preservation of project files, and dry-run
- valid and invalid config, including path traversal
- profile inheritance, explicit profiles, and auto-detection fixtures
- ECC adapter exports, a dry-run plan, and unknown skills

Fixtures for detection live in `tests/incetro/fixtures/` for Django, Python, Flutter, iOS, Go, web, and a generic directory.

## End to end

With `INCETRO_E2E=1`, CI creates a temp project and runs:

```text
init -> status -> doctor -> diff -> update -> update -> remove --dry-run -> remove --yes
```

It checks that a project rule, `AGENTS.md`, and `docs/notes.md` are unchanged, and that the Incetro rule and Incetro state are removed at the end.

## Node.js 18

Incetro tests exit successfully without running when Node is older than 20. Doctor on Node 20+ reports older Node as unhealthy.
