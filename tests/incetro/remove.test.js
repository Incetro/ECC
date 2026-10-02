'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { dispatch } = require('../../scripts/incetro/cli');
const { readState } = require('../../scripts/incetro/core/state');
const { createHarness, fakeAdapter, makeTempDir, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

function setup() {
  const project = makeTempDir('remove');
  const source = makeTempDir('source');
  writeFile(source, 'incetro/VERSION', '1.0.0\n');
  writeFile(source, 'incetro/rules/incetro-engineering.mdc', 'engineering\n');
  writeFile(source, 'incetro/profiles/core.json', JSON.stringify({
    id: 'core',
    extends: [],
    ecc: { profile: 'minimal', skills: [] },
    incetro: { rules: ['incetro-engineering'], agents: [], skills: [] },
  }));
  writeFile(project, '.cursor/rules/life-os-agent.mdc', 'keep me\n');
  writeFile(project, 'notes.txt', 'unknown\n');
  const deps = {
    cwd: project,
    adapter: fakeAdapter(),
    homeDir: project,
    sourceRoot: source,
    commit: 'testcommit',
  };
  assert.strictEqual(dispatch(['init'], deps).exitCode, 0);
  return { project, deps };
}

harness.test('dry-run removes nothing', () => {
  const { project, deps } = setup();
  const outcome = dispatch(['remove', '--dry-run'], deps);
  assert.strictEqual(outcome.exitCode, 0);
  assert.strictEqual(outcome.result.applied, false);
  assert.ok(fs.existsSync(path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc')));
  assert.ok(readState(project));
});

harness.test('remove deletes incetro-owned files only', () => {
  const { project, deps } = setup();
  const outcome = dispatch(['remove', '--yes'], deps);
  assert.strictEqual(outcome.exitCode, 0, JSON.stringify(outcome.result));
  assert.ok(!fs.existsSync(path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc')));
  assert.strictEqual(fs.readFileSync(path.join(project, '.cursor', 'rules', 'life-os-agent.mdc'), 'utf8'), 'keep me\n');
  assert.strictEqual(fs.readFileSync(path.join(project, 'notes.txt'), 'utf8'), 'unknown\n');
  assert.strictEqual(readState(project), null);
  assert.ok(deps.adapter.calls.some(call => call.type === 'uninstall' && call.input.dryRun === false));
});

harness.test('remove keeps a drifted file unless accept-incetro is set', () => {
  const { project, deps } = setup();
  const target = path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc');
  fs.writeFileSync(target, 'local\n');
  const blocked = dispatch(['remove', '--yes'], deps);
  assert.strictEqual(blocked.exitCode, 4);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'local\n');
  const kept = dispatch(['remove', '--yes', '--keep-local'], deps);
  assert.strictEqual(kept.exitCode, 0, JSON.stringify(kept.result));
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'local\n');
});

harness.finish();
