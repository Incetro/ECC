'use strict';

const assert = require('assert');
const fs = require('fs');

const { classify, summarize } = require('../../scripts/incetro/core/ownership');
const { sha256File } = require('../../scripts/incetro/core/hashes');
const { createHarness, makeTempDir, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

function desired(root, contents) {
  const source = writeFile(root, 'source.mdc', contents);
  return {
    id: 'incetro-engineering',
    kind: 'rules',
    sourceRelative: 'incetro/rules/incetro-engineering.mdc',
    sourceAbsolute: source,
    destinationRelative: '.cursor/rules/incetro-engineering.mdc',
  };
}

harness.test('unchanged owned file is up-to-date', () => {
  const root = makeTempDir('owned');
  const file = desired(root, 'rule\n');
  const destination = writeFile(root, file.destinationRelative, 'rule\n');
  const hash = sha256File(destination);
  const entries = classify({
    projectRoot: root,
    desired: [file],
    stateFiles: [{
      source: file.sourceRelative,
      destination: file.destinationRelative,
      sha256: hash,
      owner: 'incetro',
      version: '1.0.0',
    }],
    eccPaths: [],
  });
  assert.strictEqual(entries[0].status, 'up-to-date');
});

harness.test('modified owned file is drifted', () => {
  const root = makeTempDir('drift');
  const file = desired(root, 'rule\n');
  const destination = writeFile(root, file.destinationRelative, 'rule\n');
  const hash = sha256File(destination);
  fs.writeFileSync(destination, 'local edit\n');
  const summary = summarize(classify({
    projectRoot: root,
    desired: [file],
    stateFiles: [{
      source: file.sourceRelative,
      destination: file.destinationRelative,
      sha256: hash,
      owner: 'incetro',
      version: '1.0.0',
    }],
    eccPaths: [],
  }));
  assert.strictEqual(summary.drifted.length, 1);
});

harness.test('project-owned collision is conflicting', () => {
  const root = makeTempDir('collision');
  const file = desired(root, 'rule\n');
  writeFile(root, file.destinationRelative, 'project rule\n');
  const summary = summarize(classify({
    projectRoot: root,
    desired: [file],
    stateFiles: [],
    eccPaths: [],
  }));
  assert.strictEqual(summary.conflicting.length, 1);
  assert.strictEqual(summary.conflicting[0].reason, 'project-owned');
});

harness.test('missing owned file is missing', () => {
  const root = makeTempDir('missing');
  const file = desired(root, 'rule\n');
  const summary = summarize(classify({
    projectRoot: root,
    desired: [file],
    stateFiles: [{
      source: file.sourceRelative,
      destination: file.destinationRelative,
      sha256: 'a'.repeat(64),
      owner: 'incetro',
      version: '1.0.0',
    }],
    eccPaths: [],
  }));
  assert.strictEqual(summary.missing.length, 1);
});

harness.test('path traversal destinations are rejected', () => {
  const root = makeTempDir('traversal');
  const file = desired(root, 'rule\n');
  file.destinationRelative = '../outside.mdc';
  assert.throws(() => classify({
    projectRoot: root,
    desired: [file],
    stateFiles: [],
    eccPaths: [],
  }), /outside project root/);
});

harness.finish();
