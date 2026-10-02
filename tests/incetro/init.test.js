'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { dispatch } = require('../../scripts/incetro/cli');
const { readState } = require('../../scripts/incetro/core/state');
const { createHarness, fakeAdapter, makeTempDir, repoRoot, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

function sourceWith(ruleText) {
  const source = makeTempDir('source');
  writeFile(source, 'incetro/VERSION', '1.0.0\n');
  writeFile(source, 'incetro/rules/incetro-engineering.mdc', ruleText);
  writeFile(source, 'incetro/profiles/core.json', JSON.stringify({
    id: 'core',
    extends: [],
    ecc: { profile: 'minimal', skills: [] },
    incetro: { rules: ['incetro-engineering'], agents: [], skills: [] },
  }));
  return source;
}

function options(project, source, adapter = fakeAdapter()) {
  return {
    cwd: project,
    adapter,
    homeDir: project,
    sourceRoot: source,
    commit: 'testcommit',
  };
}

harness.test('init installs into an empty project', () => {
  const project = makeTempDir('empty');
  const source = sourceWith('engineering\n');
  const outcome = dispatch(['init'], options(project, source));
  assert.strictEqual(outcome.exitCode, 0, JSON.stringify(outcome.result));
  assert.strictEqual(outcome.result.profile, 'core');
  assert.ok(fs.existsSync(path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc')));
  assert.ok(readState(project));
});

harness.test('init preserves existing project rules', () => {
  const project = makeTempDir('existing');
  const source = sourceWith('engineering\n');
  const projectRule = writeFile(project, '.cursor/rules/life-os-agent.mdc', 'project rule\n');
  writeFile(project, 'AGENTS.md', 'project agents\n');
  writeFile(project, 'docs/notes.md', 'notes\n');
  const outcome = dispatch(['init'], options(project, source));
  assert.strictEqual(outcome.exitCode, 0, JSON.stringify(outcome.result));
  assert.strictEqual(fs.readFileSync(projectRule, 'utf8'), 'project rule\n');
  assert.strictEqual(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8'), 'project agents\n');
  assert.strictEqual(fs.readFileSync(path.join(project, 'docs', 'notes.md'), 'utf8'), 'notes\n');
  assert.strictEqual(outcome.result.preservedProjectFiles, 1);
});

harness.test('repeat init does not duplicate state', () => {
  const project = makeTempDir('repeat');
  const source = sourceWith('engineering\n');
  const deps = options(project, source);
  assert.strictEqual(dispatch(['init'], deps).exitCode, 0);
  const first = fs.readFileSync(path.join(project, '.incetro-ecc', 'state.json'), 'utf8');
  const second = dispatch(['init'], deps);
  assert.strictEqual(second.exitCode, 0);
  assert.strictEqual(second.result.alreadyInitialized, true);
  assert.match(second.result.type, /init/);
  assert.strictEqual(fs.readFileSync(path.join(project, '.incetro-ecc', 'state.json'), 'utf8'), first);
});

harness.test('init refuses a project-owned name collision', () => {
  const project = makeTempDir('conflict-init');
  const source = sourceWith('engineering\n');
  const target = writeFile(project, '.cursor/rules/incetro-engineering.mdc', 'local\n');
  const outcome = dispatch(['init'], options(project, source));
  assert.strictEqual(outcome.exitCode, 3);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), 'local\n');
  assert.strictEqual(readState(project), null);
});

harness.finish();
