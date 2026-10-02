'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { dispatch } = require('../../scripts/incetro/cli');
const { createHarness, fakeAdapter, makeTempDir, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

function sourceWith(files) {
  const source = makeTempDir('source');
  writeFile(source, 'incetro/VERSION', '1.0.0\n');
  writeFile(source, 'incetro/rules/incetro-engineering.mdc', files.rule);
  if (files.extra) writeFile(source, 'incetro/rules/incetro-security.mdc', files.extra);
  const rules = files.extra ? ['incetro-engineering', 'incetro-security'] : ['incetro-engineering'];
  writeFile(source, 'incetro/profiles/core.json', JSON.stringify({
    id: 'core',
    extends: [],
    ecc: { profile: 'minimal', skills: [] },
    incetro: { rules, agents: [], skills: [] },
  }));
  return source;
}

function boot(rule = 'v1\n') {
  const project = makeTempDir('project');
  const source = sourceWith({ rule });
  const deps = {
    cwd: project,
    adapter: fakeAdapter(),
    homeDir: project,
    sourceRoot: source,
    commit: 'testcommit',
  };
  const init = dispatch(['init'], deps);
  assert.strictEqual(init.exitCode, 0, JSON.stringify(init.result));
  return { project, source, deps };
}

harness.test('update with no source changes keeps the file', () => {
  const { project, deps } = boot();
  const target = path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc');
  const before = fs.readFileSync(target);
  const outcome = dispatch(['update'], deps);
  assert.strictEqual(outcome.exitCode, 0, JSON.stringify(outcome.result));
  assert.strictEqual(outcome.result.incetroUpdated, 0);
  assert.ok(outcome.result.incetroUnchanged >= 1);
  assert.ok(fs.readFileSync(target).equals(before));
});

harness.test('update installs a new component and refreshes a changed one', () => {
  const { project, source, deps } = boot('v1\n');
  writeFile(source, 'incetro/rules/incetro-engineering.mdc', 'v2\n');
  writeFile(source, 'incetro/rules/incetro-security.mdc', 'security\n');
  writeFile(source, 'incetro/profiles/core.json', JSON.stringify({
    id: 'core',
    extends: [],
    ecc: { profile: 'minimal', skills: [] },
    incetro: { rules: ['incetro-engineering', 'incetro-security'], agents: [], skills: [] },
  }));
  const outcome = dispatch(['update'], deps);
  assert.strictEqual(outcome.exitCode, 0, JSON.stringify(outcome.result));
  assert.strictEqual(
    fs.readFileSync(path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc'), 'utf8'),
    'v2\n'
  );
  assert.strictEqual(
    fs.readFileSync(path.join(project, '.cursor', 'rules', 'incetro-security.mdc'), 'utf8'),
    'security\n'
  );
  assert.ok(outcome.result.incetroUpdated >= 2);
});

harness.test('update removes a component that left the profile', () => {
  const project = makeTempDir('remove-component');
  const source = sourceWith({ rule: 'rule\n', extra: 'security\n' });
  const deps = {
    cwd: project,
    adapter: fakeAdapter(),
    homeDir: project,
    sourceRoot: source,
    commit: 'testcommit',
  };
  assert.strictEqual(dispatch(['init'], deps).exitCode, 0);
  writeFile(source, 'incetro/profiles/core.json', JSON.stringify({
    id: 'core',
    extends: [],
    ecc: { profile: 'minimal', skills: [] },
    incetro: { rules: ['incetro-engineering'], agents: [], skills: [] },
  }));
  const outcome = dispatch(['update'], deps);
  assert.strictEqual(outcome.exitCode, 0, JSON.stringify(outcome.result));
  assert.ok(!fs.existsSync(path.join(project, '.cursor', 'rules', 'incetro-security.mdc')));
  assert.ok(fs.existsSync(path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc')));
});

harness.test('drift blocks update until a flag is set', () => {
  const { project, source, deps } = boot('v1\n');
  const target = path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc');
  fs.writeFileSync(target, 'local edit\n');
  writeFile(source, 'incetro/rules/incetro-engineering.mdc', 'v2\n');
  const blocked = dispatch(['update'], deps);
  assert.strictEqual(blocked.exitCode, 4);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'local edit\n');
  const kept = dispatch(['update', '--keep-local'], deps);
  assert.strictEqual(kept.exitCode, 0, JSON.stringify(kept.result));
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'local edit\n');
  const accepted = dispatch(['update', '--accept-incetro'], deps);
  assert.strictEqual(accepted.exitCode, 0, JSON.stringify(accepted.result));
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'v2\n');
});

harness.test('conflict blocks update', () => {
  const { project, source, deps } = boot('v1\n');
  writeFile(source, 'incetro/rules/incetro-security.mdc', 'security\n');
  writeFile(project, '.cursor/rules/incetro-security.mdc', 'project security\n');
  writeFile(source, 'incetro/profiles/core.json', JSON.stringify({
    id: 'core',
    extends: [],
    ecc: { profile: 'minimal', skills: [] },
    incetro: { rules: ['incetro-engineering', 'incetro-security'], agents: [], skills: [] },
  }));
  const outcome = dispatch(['update'], deps);
  assert.strictEqual(outcome.exitCode, 3);
  assert.strictEqual(
    fs.readFileSync(path.join(project, '.cursor', 'rules', 'incetro-security.mdc'), 'utf8'),
    'project security\n'
  );
});

harness.finish();
