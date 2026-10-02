'use strict';

const fs = require('fs');

const { sha256File } = require('./hashes');
const { assertContained, joinInside, lstatOrNull } = require('./paths');

function indexByDestination(files) {
  const index = new Map();
  for (const file of files || []) {
    index.set(file.destination, file);
  }
  return index;
}

function classifyDesiredFile(projectRoot, desired, stateEntry, eccOwned) {
  const absolute = joinInside(projectRoot, desired.destinationRelative);
  assertContained(projectRoot, absolute);
  const sourceHash = sha256File(desired.sourceAbsolute);
  const base = {
    ...desired,
    absolute,
    sourceHash,
    recordedHash: stateEntry ? stateEntry.sha256 : null,
    currentHash: null,
  };
  if (eccOwned) {
    return { ...base, status: 'conflicting', reason: 'ecc-owned' };
  }
  const stat = lstatOrNull(absolute);
  if (stat && stat.isSymbolicLink()) {
    return {
      ...base,
      status: stateEntry ? 'drifted' : 'conflicting',
      reason: 'symlink',
    };
  }
  if (stat && !stat.isFile()) {
    return { ...base, status: 'conflicting', reason: 'not-a-file' };
  }
  if (!stat) {
    return { ...base, status: stateEntry ? 'missing' : 'new' };
  }
  const currentHash = sha256File(absolute);
  const withHash = { ...base, currentHash };
  if (!stateEntry) {
    return { ...withHash, status: 'conflicting', reason: 'project-owned' };
  }
  if (currentHash !== stateEntry.sha256) {
    return { ...withHash, status: 'drifted', reason: 'modified' };
  }
  if (currentHash !== sourceHash) {
    return { ...withHash, status: 'outdated' };
  }
  return { ...withHash, status: 'up-to-date' };
}

function classifyRemovedFile(projectRoot, stateEntry) {
  const absolute = joinInside(projectRoot, stateEntry.destination);
  const stat = lstatOrNull(absolute);
  const base = {
    id: null,
    kind: null,
    sourceRelative: stateEntry.source,
    sourceAbsolute: null,
    destinationRelative: stateEntry.destination,
    absolute,
    sourceHash: null,
    recordedHash: stateEntry.sha256,
    currentHash: null,
  };
  if (!stat) {
    return { ...base, status: 'removed-missing' };
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return { ...base, status: 'drifted', reason: 'removed-component' };
  }
  const currentHash = sha256File(absolute);
  if (currentHash !== stateEntry.sha256) {
    return { ...base, currentHash, status: 'drifted', reason: 'removed-component' };
  }
  return { ...base, currentHash, status: 'removed' };
}

/**
 * @param {{ projectRoot: string, desired: object[], stateFiles: object[], eccPaths: string[] }} input
 */
function classify(input) {
  const stateIndex = indexByDestination(input.stateFiles);
  const eccOwned = new Set((input.eccPaths || []).map(value => pathKey(value)));
  const desiredDestinations = new Set();
  const entries = [];

  for (const desired of input.desired) {
    if (desiredDestinations.has(desired.destinationRelative)) {
      entries.push({
        ...desired,
        absolute: joinInside(input.projectRoot, desired.destinationRelative),
        status: 'conflicting',
        reason: 'duplicate-destination',
        sourceHash: null,
        recordedHash: null,
        currentHash: null,
      });
      continue;
    }
    desiredDestinations.add(desired.destinationRelative);
    const absolute = joinInside(input.projectRoot, desired.destinationRelative);
    const owned = eccOwned.has(pathKey(absolute)) || eccOwned.has(pathKey(desired.destinationRelative));
    entries.push(classifyDesiredFile(
      input.projectRoot,
      desired,
      stateIndex.get(desired.destinationRelative) || null,
      owned
    ));
  }

  for (const stateEntry of input.stateFiles || []) {
    if (desiredDestinations.has(stateEntry.destination)) continue;
    entries.push(classifyRemovedFile(input.projectRoot, stateEntry));
  }

  return entries;
}

function pathKey(value) {
  const normalized = String(value || '').split('\\').join('/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function summarize(entries) {
  const buckets = {
    'up-to-date': [],
    outdated: [],
    drifted: [],
    missing: [],
    conflicting: [],
    new: [],
    removed: [],
    'removed-missing': [],
  };
  for (const entry of entries) {
    if (!buckets[entry.status]) buckets[entry.status] = [];
    buckets[entry.status].push(entry);
  }
  return buckets;
}

function blockingExitCode(summary, flags = {}) {
  if (summary.conflicting.length > 0) return 3;
  const drifted = summary.drifted.length > 0;
  if (drifted && !flags.keepLocal && !flags.acceptIncetro) return 4;
  return 0;
}

function fileBytes(filePath) {
  return fs.readFileSync(filePath);
}

module.exports = {
  blockingExitCode,
  classify,
  fileBytes,
  summarize,
};
