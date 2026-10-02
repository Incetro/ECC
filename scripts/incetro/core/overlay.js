'use strict';

const { SCHEMA_VERSION } = require('../constants');
const { sha256Buffer, sha256File } = require('./hashes');
const { fileBytes } = require('./ownership');
const { applyTransaction } = require('./transaction');
const { joinInside, listRelativeFiles } = require('./paths');
const { writeState } = require('./state');

function buildDesired(sourceRoot, projectRoot, selection, target, catalog) {
  void sourceRoot;
  void projectRoot;
  const files = [];
  for (const kind of ['rules', 'agents', 'skills']) {
    for (const id of selection.incetro[kind]) {
      const component = catalog.byId.get(id);
      files.push(...target.mapComponent(component));
    }
  }
  return files;
}

function operationsForEntries(entries, flags) {
  const operations = [];
  for (const entry of entries) {
    if (flags.remove) {
      const deleteDrift = entry.status === 'drifted' && flags.acceptIncetro;
      const deleteOwned = entry.status === 'up-to-date'
        || entry.status === 'outdated'
        || entry.status === 'removed';
      if (deleteOwned || deleteDrift) {
        operations.push({
          type: 'delete',
          absolute: entry.absolute,
          destinationRelative: entry.destinationRelative,
        });
      }
      continue;
    }
    const writable = entry.status === 'new'
      || entry.status === 'missing'
      || entry.status === 'outdated'
      || (entry.status === 'drifted' && flags.acceptIncetro && entry.sourceAbsolute);
    if (writable) {
      operations.push({
        type: 'write',
        absolute: entry.absolute,
        destinationRelative: entry.destinationRelative,
        contents: fileBytes(entry.sourceAbsolute),
      });
      continue;
    }
    if (entry.status === 'removed' || (entry.status === 'drifted' && flags.acceptIncetro && !entry.sourceAbsolute)) {
      operations.push({
        type: 'delete',
        absolute: entry.absolute,
        destinationRelative: entry.destinationRelative,
      });
    }
  }
  return operations;
}

function stateFilesFromEntries(entries, version, flags) {
  if (flags.remove) {
    return entries
      .filter(entry => entry.status === 'drifted' && !flags.acceptIncetro && entry.recordedHash && entry.sourceRelative)
      .map(entry => ({
        source: entry.sourceRelative,
        destination: entry.destinationRelative,
        sha256: entry.recordedHash,
        owner: 'incetro',
        version,
      }));
  }
  const files = [];
  for (const entry of entries) {
    if (entry.status === 'conflicting') continue;
    if (entry.status === 'removed' || entry.status === 'removed-missing') continue;
    if (entry.status === 'drifted' && flags.acceptIncetro && !entry.sourceAbsolute) continue;
    if (!entry.sourceRelative || !entry.sourceAbsolute) {
      if (entry.status === 'drifted' || entry.status === 'up-to-date' || entry.status === 'outdated') {
        files.push({
          source: entry.sourceRelative,
          destination: entry.destinationRelative,
          sha256: entry.recordedHash,
          owner: 'incetro',
          version,
        });
      }
      continue;
    }
    const wrote = entry.status === 'new'
      || entry.status === 'missing'
      || entry.status === 'outdated'
      || (entry.status === 'drifted' && flags.acceptIncetro);
    const sha256 = wrote ? sha256File(entry.sourceAbsolute) : entry.recordedHash;
    files.push({
      source: entry.sourceRelative,
      destination: entry.destinationRelative,
      sha256,
      owner: 'incetro',
      version,
    });
  }
  return files;
}

function countPreservedRules(projectRoot, writtenDestinations) {
  const beforeRules = snapshotRules(projectRoot);
  const written = writtenDestinations instanceof Set
    ? writtenDestinations
    : new Set(writtenDestinations || []);
  return beforeRules.filter(relative => !written.has(relative)).length;
}

function snapshotRules(projectRoot) {
  const rulesDir = joinInside(projectRoot, '.cursor/rules');
  return listRelativeFiles(rulesDir).map(relative => `.cursor/rules/${relative}`);
}

function applyManagedChanges(context, entries, flags) {
  const operations = operationsForEntries(entries, flags);
  for (const operation of operations) {
    if (operation.contents) {
      const expected = sha256Buffer(operation.contents);
      operation.expectedHash = expected;
    }
  }
  const files = stateFilesFromEntries(entries, context.incetroVersion, flags);
  const now = new Date().toISOString();
  const versions = context.adapter.versions();
  const state = {
    schemaVersion: SCHEMA_VERSION,
    installedAt: context.state ? context.state.installedAt : now,
    updatedAt: now,
    incetro: {
      version: context.incetroVersion,
      commit: context.commit,
    },
    upstream: {
      version: versions.version || '0.0.0',
      commit: context.commit,
    },
    target: context.target.id,
    profile: flags.profileId,
    files,
  };
  const transaction = applyTransaction(context.projectRoot, operations);
  try {
    for (const operation of operations) {
      if (operation.type !== 'write') continue;
      const actual = sha256File(operation.absolute);
      if (actual !== operation.expectedHash) {
        throw new Error(`Integrity check failed for ${operation.destinationRelative}`);
      }
    }
    writeState(context.projectRoot, state);
    transaction.commit();
  } catch (error) {
    transaction.rollback();
    throw error;
  }
  return {
    state,
    updated: operations.filter(operation => operation.type === 'write').length,
    deleted: operations.filter(operation => operation.type === 'delete').length,
  };
}

module.exports = {
  applyManagedChanges,
  buildDesired,
  countPreservedRules,
  operationsForEntries,
  snapshotRules,
  stateFilesFromEntries,
};
