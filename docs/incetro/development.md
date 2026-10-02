# Development

Incetro code stays in `incetro/`, `scripts/incetro/`, `tests/incetro/`, and `docs/incetro/`.

The only upstream integration in `package.json` is the `incetro-ecc` binary, `test:incetro`, and the publish file list. The package name remains `ecc-universal`.

## Run the CLI from the checkout

```bash
node scripts/incetro-ecc.js version
node scripts/incetro-ecc.js init --help
```

## Tests

```bash
npm run test:incetro
INCETRO_E2E=1 node tests/incetro/e2e-smoke.test.js
```

The shared `npm test` suite discovers `tests/incetro/*.test.js`. The filesystem smoke test runs when `INCETRO_E2E=1`, which Incetro CI sets. Node.js 18 skips these tests so the existing ECC matrix can keep that version.

## Adapter

Call ECC only through `scripts/incetro/core/ecc-adapter.js`. Contract tests in `tests/incetro/ecc-adapter.test.js` load the real installer and build a dry-run Cursor plan.

## Adding a target later

Add `scripts/incetro/targets/<id>.js` and register it in `scripts/incetro/targets/index.js`. Profiles can then set `"target": "<id>"`. Cursor remains the only target in this version.
