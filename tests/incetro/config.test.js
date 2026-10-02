'use strict';

const assert = require('assert');
const { IncetroError } = require('../../scripts/incetro/constants');
const { loadConfig, parseConfig } = require('../../scripts/incetro/core/config');
const { createHarness, makeTempDir, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

harness.test('valid config loads', () => {
  const root = makeTempDir('config');
  writeFile(root, '.incetro-ecc.json', JSON.stringify({
    target: 'cursor',
    profile: 'django',
    autoDetectProfile: false,
    include: ['incetro-example'],
    exclude: [],
  }));
  const config = loadConfig(root);
  assert.strictEqual(config.profile, 'django');
  assert.strictEqual(config.autoDetectProfile, false);
  assert.deepStrictEqual(config.include, ['incetro-example']);
});

harness.test('invalid JSON is rejected', () => {
  const root = makeTempDir('bad-json');
  writeFile(root, '.incetro-ecc.json', '{');
  assert.throws(() => loadConfig(root), error => error instanceof IncetroError && error.exitCode === 2);
});

harness.test('invalid profile is rejected', () => {
  assert.throws(
    () => parseConfig('{"profile":"../django"}', '.incetro-ecc.json'),
    /Invalid profile/
  );
});

harness.test('path traversal in include is rejected', () => {
  assert.throws(
    () => parseConfig('{"include":["../../etc/passwd"]}', '.incetro-ecc.json'),
    /Invalid include entry/
  );
});

harness.test('missing config uses defaults', () => {
  const root = makeTempDir('no-config');
  const config = loadConfig(root);
  assert.strictEqual(config.target, 'cursor');
  assert.strictEqual(config.profile, null);
  assert.strictEqual(config.autoDetectProfile, true);
});

harness.finish();
