'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { resolveProjectRoot } = require('../../scripts/incetro/core/project');
const { createHarness, makeTempDir, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr);
}

harness.test('plain directory uses the working directory', () => {
  const root = makeTempDir('plain');
  assert.strictEqual(resolveProjectRoot({ cwd: root }), fs.realpathSync(root));
});

harness.test('git project uses the git root', () => {
  const root = makeTempDir('git');
  git(root, ['init']);
  const nested = path.join(root, 'nested');
  fs.mkdirSync(nested);
  assert.strictEqual(resolveProjectRoot({ cwd: nested }), fs.realpathSync(root));
});

harness.test('explicit path is not walked upward', () => {
  const root = makeTempDir('explicit');
  git(root, ['init']);
  const nested = path.join(root, 'nested');
  fs.mkdirSync(nested);
  assert.strictEqual(resolveProjectRoot({ cwd: root, explicitPath: 'nested' }), fs.realpathSync(nested));
});

harness.test('path with spaces resolves', () => {
  const parent = makeTempDir('spaces');
  const root = path.join(parent, 'my project');
  fs.mkdirSync(root);
  writeFile(root, 'README.md', 'hello');
  assert.strictEqual(resolveProjectRoot({ cwd: parent, explicitPath: 'my project' }), fs.realpathSync(root));
});

harness.test('unicode path resolves', () => {
  const parent = makeTempDir('unicode');
  const root = path.join(parent, 'проект');
  fs.mkdirSync(root);
  assert.strictEqual(resolveProjectRoot({ cwd: parent, explicitPath: 'проект' }), fs.realpathSync(root));
});

harness.finish();
