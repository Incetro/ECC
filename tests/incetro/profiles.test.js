'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { loadCatalog } = require('../../scripts/incetro/core/manifest');
const { detectProfile, resolveSelection } = require('../../scripts/incetro/core/profiles');
const { getTarget } = require('../../scripts/incetro/targets');
const { buildDesired } = require('../../scripts/incetro/core/overlay');
const { createHarness, fakeAdapter, makeTempDir, repoRoot, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
const harness = createHarness();
const fixtures = path.join(__dirname, 'fixtures');

harness.test('django profile inherits python and core components', () => {
  const catalog = loadCatalog(repoRoot);
  const selection = resolveSelection({
    sourceRoot: repoRoot,
    profileId: 'django',
    catalog,
    config: { include: [], exclude: [] },
    adapter: fakeAdapter(),
    target: 'cursor',
  });
  assert.strictEqual(selection.ecc.profile, 'minimal');
  assert.ok(selection.ecc.skills.includes('python-patterns'));
  assert.ok(selection.ecc.skills.includes('django-tdd'));
  assert.ok(selection.incetro.rules.includes('incetro-engineering'));
  assert.ok(selection.incetro.skills.includes('incetro-example'));
});

harness.test('explicit profile is used instead of detection', () => {
  const detected = detectProfile(path.join(fixtures, 'django'));
  assert.strictEqual(detected.profile, 'django');
  assert.notStrictEqual(detected.profile, 'web');
});

harness.test('auto-detection fixtures', () => {
  assert.strictEqual(detectProfile(path.join(fixtures, 'django')).profile, 'django');
  assert.strictEqual(detectProfile(path.join(fixtures, 'python')).profile, 'python');
  assert.strictEqual(detectProfile(path.join(fixtures, 'flutter')).profile, 'flutter');
  assert.strictEqual(detectProfile(path.join(fixtures, 'ios')).profile, 'ios');
  assert.strictEqual(detectProfile(path.join(fixtures, 'go')).profile, 'go');
  assert.strictEqual(detectProfile(path.join(fixtures, 'web')).profile, 'web');
  assert.strictEqual(detectProfile(path.join(fixtures, 'generic')).profile, 'core');
});

harness.test('mixed signals stay on core', () => {
  const root = makeTempDir('mixed');
  writeFile(root, 'go.mod', 'module example.com/demo\n\ngo 1.22\n');
  writeFile(root, 'package.json', '{"name":"demo"}\n');
  const detected = detectProfile(root);
  assert.strictEqual(detected.profile, 'core');
  assert.strictEqual(detected.confident, false);
});

harness.test('a new overlay file is installed from the profile without installer changes', () => {
  const source = makeTempDir('overlay');
  writeFile(source, 'incetro/rules/incetro-custom.mdc', '---\ndescription: custom\n---\ncustom\n');
  writeFile(source, 'incetro/profiles/core.json', JSON.stringify({
    id: 'core',
    extends: [],
    ecc: { profile: 'minimal' },
    incetro: { rules: ['incetro-custom'], agents: [], skills: [] },
  }));
  const catalog = loadCatalog(source);
  const selection = resolveSelection({
    sourceRoot: source,
    profileId: 'core',
    catalog,
    config: { include: [], exclude: [] },
    adapter: fakeAdapter(),
    target: 'cursor',
  });
  const desired = buildDesired(source, source, selection, getTarget('cursor'), catalog);
  assert.ok(desired.some(file => file.destinationRelative === '.cursor/rules/incetro-custom.mdc'));
  assert.ok(!fs.existsSync(path.join(source, 'scripts')));
});

harness.finish();
