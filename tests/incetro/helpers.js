'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'scripts', 'incetro-ecc.js');

function skipIfOldNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) return false;
  console.log('ok skipped on Node < 20');
  console.log('Passed: 1');
  console.log('Failed: 0');
  process.exit(0);
  return true;
}

function createHarness() {
  let passed = 0;
  let failed = 0;
  return {
    test(name, fn) {
      try {
        fn();
        passed += 1;
        console.log(`ok ${name}`);
      } catch (error) {
        failed += 1;
        console.log(`FAIL ${name}`);
        console.log(error && error.stack ? error.stack : error);
      }
    },
    finish() {
      console.log(`\nPassed: ${passed}`);
      console.log(`Failed: ${failed}`);
      process.exit(failed > 0 ? 1 : 0);
    },
  };
}

function makeTempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `incetro-ecc-${name}-`));
}

function writeFile(root, relative, contents) {
  const absolute = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
  return absolute;
}

function fakeAdapter(overrides = {}) {
  const calls = [];
  const adapter = {
    calls,
    checkCompatibility() {
      return { ok: true, errors: [], version: '2.2.3', expected: ['contract'], detected: ['ecc 2.2.3'] };
    },
    formatCompatibility(result) {
      return `ECC compatibility check failed. ${result.errors.map(error => error.detected).join('; ')}`;
    },
    versions() {
      return { version: '2.2.3', commit: 'abc123' };
    },
    assertSelection() {},
    install(input) {
      calls.push({ type: 'install', input });
      return {
        ok: true,
        dryRun: Boolean(input.dryRun),
        applied: !input.dryRun,
        operationCount: 4,
        changed: input.dryRun ? 0 : 2,
        warnings: [],
        skipped: 0,
        installStatePath: path.join(input.projectRoot, '.cursor', 'ecc-install-state.json'),
      };
    },
    doctor() {
      return { ok: true, status: 'ok', issues: [], driftedPaths: [], missingPaths: [], checkedCount: 1 };
    },
    uninstall(input) {
      calls.push({ type: 'uninstall', input });
      return { ok: true, dryRun: Boolean(input.dryRun), removedCount: 4, retainedCount: 0, warnings: [] };
    },
    listManagedPaths() {
      return [];
    },
    ...overrides,
  };
  return adapter;
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
}

module.exports = {
  cliPath,
  createHarness,
  fakeAdapter,
  makeTempDir,
  repoRoot,
  runCli,
  skipIfOldNode,
  writeFile,
};
