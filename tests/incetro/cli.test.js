'use strict';

const assert = require('assert');
const { dispatch } = require('../../scripts/incetro/cli');
const { createHarness, skipIfOldNode } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

harness.test('help returns usage and exit 0', () => {
  const outcome = dispatch(['help']);
  assert.strictEqual(outcome.exitCode, 0);
  assert.match(outcome.result.text, /incetro-ecc init/);
  assert.match(outcome.result.text, /Exit codes:/);
});

harness.test('version reports incetro and ecc versions', () => {
  const outcome = dispatch(['version']);
  assert.strictEqual(outcome.exitCode, 0);
  assert.match(outcome.result.incetroVersion, /^\d+\.\d+\.\d+$/);
  assert.match(outcome.result.eccVersion, /^\d+\.\d+\.\d+/);
});

harness.test('unknown command fails', () => {
  assert.throws(() => dispatch(['nope']), /Unknown command: nope/);
});

harness.test('invalid arguments fail', () => {
  assert.throws(() => dispatch(['version', 'extra']), /does not accept a project path/);
  assert.throws(() => dispatch(['init', '--profile']), /Missing value for --profile/);
  assert.throws(() => dispatch(['update', '--keep-local', '--accept-incetro']), /cannot be combined/);
  assert.throws(() => dispatch(['init', '--profile', '../secret']), /Invalid profile/);
});

harness.finish();
