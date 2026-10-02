'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { createHarness, runCli, makeTempDir, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
if (process.env.INCETRO_E2E !== '1') {
  console.log('ok skipped filesystem e2e (set INCETRO_E2E=1)');
  console.log('Passed: 1');
  console.log('Failed: 0');
  process.exit(0);
}

const harness = createHarness();

function read(filePath) {
  return fs.readFileSync(filePath);
}

harness.test('init status doctor update remove on a temp project', () => {
  const project = makeTempDir('e2e');
  const projectRule = writeFile(project, '.cursor/rules/life-os-agent.mdc', 'project rule\n');
  const agents = writeFile(project, 'AGENTS.md', 'project agents\n');
  const notes = writeFile(project, 'docs/notes.md', 'notes\n');
  const rulePath = path.join(project, '.cursor', 'rules', 'incetro-engineering.mdc');

  const init = runCli(['init', '--profile', 'core', project], project);
  assert.strictEqual(init.status, 0, `${init.stdout}\n${init.stderr}`);
  assert.match(init.stdout, /Incetro ECC initialized/);
  assert.ok(fs.existsSync(rulePath));
  assert.ok(fs.existsSync(path.join(project, '.cursor', 'ecc-install-state.json')));
  assert.ok(read(projectRule).equals(Buffer.from('project rule\n')));
  assert.ok(read(agents).equals(Buffer.from('project agents\n')));
  assert.ok(read(notes).equals(Buffer.from('notes\n')));

  const status = runCli(['status', '--json', project], project);
  assert.strictEqual(status.status, 0, status.stderr);
  const statusJson = JSON.parse(status.stdout);
  assert.strictEqual(statusJson.profile, 'core');
  assert.strictEqual(statusJson.overlayStatus, 'healthy');

  const doctor = runCli(['doctor', project], project);
  assert.strictEqual(doctor.status, 0, `${doctor.stdout}\n${doctor.stderr}`);

  const diff = runCli(['diff', '--json', project], project);
  assert.strictEqual(diff.status, 0, diff.stdout);
  const diffJson = JSON.parse(diff.stdout);
  assert.ok(diffJson.counts['up-to-date'] > 0);

  const update = runCli(['update', project], project);
  assert.strictEqual(update.status, 0, `${update.stdout}\n${update.stderr}`);
  const again = runCli(['update', project], project);
  assert.strictEqual(again.status, 0, `${again.stdout}\n${again.stderr}`);
  assert.ok(read(projectRule).equals(Buffer.from('project rule\n')));

  const preview = runCli(['remove', '--dry-run', project], project);
  assert.strictEqual(preview.status, 0, preview.stderr);
  assert.ok(fs.existsSync(rulePath));

  const removed = runCli(['remove', '--yes', project], project);
  assert.strictEqual(removed.status, 0, `${removed.stdout}\n${removed.stderr}`);
  assert.ok(!fs.existsSync(rulePath));
  assert.ok(!fs.existsSync(path.join(project, '.incetro-ecc', 'state.json')));
  assert.ok(read(projectRule).equals(Buffer.from('project rule\n')));
  assert.ok(read(agents).equals(Buffer.from('project agents\n')));
  assert.ok(read(notes).equals(Buffer.from('notes\n')));
});

harness.finish();
