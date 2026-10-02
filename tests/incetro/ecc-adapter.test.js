'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { createEccAdapter, loadModules } = require('../../scripts/incetro/core/ecc-adapter');
const { createHarness, makeTempDir, repoRoot, skipIfOldNode } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

harness.test('ecc adapter contract loads', () => {
  const loaded = loadModules(repoRoot);
  assert.strictEqual(loaded.ok, true, JSON.stringify(loaded.errors));
  assert.match(loaded.version, /^\d+\.\d+\.\d+/);
});

harness.test('dry-run cursor plan stays inside the project', () => {
  const project = makeTempDir('adapter');
  const home = makeTempDir('home');
  const adapter = createEccAdapter({ sourceRoot: repoRoot });
  const plan = adapter.install({
    projectRoot: project,
    target: 'cursor',
    profileId: 'minimal',
    skillIds: ['django-patterns'],
    moduleIds: [],
    hooks: false,
    dryRun: true,
    homeDir: home,
  });
  assert.strictEqual(plan.dryRun, true);
  assert.ok(plan.operationCount > 0);
  assert.ok(String(plan.installStatePath).startsWith(path.resolve(project)));
  assert.ok(!fs.existsSync(path.join(project, '.cursor', 'ecc-install-state.json')));
});

harness.test('unknown ecc skill is a configuration error', () => {
  const adapter = createEccAdapter({ sourceRoot: repoRoot });
  assert.throws(
    () => adapter.assertSelection({
      target: 'cursor',
      profileId: 'minimal',
      skillIds: ['not-a-real-skill'],
      moduleIds: [],
    }),
    /Unknown ECC skill/
  );
});

harness.test('doctor and uninstall exports return stable shapes', () => {
  const project = makeTempDir('lifecycle');
  const home = makeTempDir('home');
  const adapter = createEccAdapter({ sourceRoot: repoRoot });
  const doctor = adapter.doctor({ projectRoot: project, target: 'cursor', homeDir: home });
  assert.ok(['ok', 'warning', 'error', 'absent'].includes(doctor.status));
  assert.ok(Array.isArray(doctor.issues));
  const uninstall = adapter.uninstall({
    projectRoot: project,
    target: 'cursor',
    homeDir: home,
    dryRun: true,
  });
  assert.strictEqual(uninstall.dryRun, true);
  assert.strictEqual(typeof uninstall.removedCount, 'number');
});

harness.finish();
