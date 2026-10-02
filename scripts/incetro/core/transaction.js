'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { EXIT, IncetroError } = require('../constants');
const { lstatOrNull, mkdirContained } = require('./paths');

function rollbackJournal(journal) {
  for (const entry of [...journal].reverse()) {
    if (entry.tmp) fs.rmSync(entry.tmp, { force: true });
    if (entry.replaced) {
      if (lstatOrNull(entry.absolute)) fs.rmSync(entry.absolute, { force: true });
      if (entry.backup && lstatOrNull(entry.backup)) {
        fs.renameSync(entry.backup, entry.absolute);
      }
    } else if (entry.created && lstatOrNull(entry.absolute)) {
      fs.rmSync(entry.absolute, { force: true });
    }
  }
}

function applyOperation(projectRoot, operation) {
  const absolute = operation.absolute;
  const stat = lstatOrNull(absolute);
  if (stat && stat.isSymbolicLink()) {
    throw new IncetroError(`Refusing to modify symlink: ${operation.destinationRelative || absolute}`, EXIT.CONFIG);
  }
  const token = crypto.randomBytes(4).toString('hex');
  const entry = {
    absolute,
    backup: null,
    tmp: null,
    created: false,
    replaced: false,
  };

  if (operation.type === 'delete') {
    if (!stat) return entry;
    if (!stat.isFile()) {
      throw new IncetroError(`Refusing to delete non-file: ${absolute}`, EXIT.CONFIG);
    }
    entry.backup = `${absolute}.${token}.incetro-bak`;
    entry.replaced = true;
    fs.renameSync(absolute, entry.backup);
    return entry;
  }

  mkdirContained(projectRoot, path.dirname(absolute));
  entry.tmp = `${absolute}.${token}.incetro-tmp`;
  fs.writeFileSync(entry.tmp, operation.contents);
  if (stat) {
    if (!stat.isFile()) {
      fs.rmSync(entry.tmp, { force: true });
      throw new IncetroError(`Refusing to replace non-file: ${absolute}`, EXIT.CONFIG);
    }
    entry.backup = `${absolute}.${token}.incetro-bak`;
    entry.replaced = true;
    fs.renameSync(absolute, entry.backup);
  } else {
    entry.created = true;
  }
  try {
    fs.renameSync(entry.tmp, absolute);
    entry.tmp = null;
  } catch (error) {
    if (entry.backup) fs.renameSync(entry.backup, absolute);
    fs.rmSync(entry.tmp, { force: true });
    throw error;
  }
  return entry;
}

function applyTransaction(projectRoot, operations) {
  const journal = [];
  try {
    for (const operation of operations) {
      journal.push(applyOperation(projectRoot, operation));
    }
  } catch (error) {
    rollbackJournal(journal);
    throw error;
  }

  return {
    commit() {
      for (const entry of journal) {
        if (entry.backup && lstatOrNull(entry.backup)) fs.rmSync(entry.backup, { force: true });
        if (entry.tmp && lstatOrNull(entry.tmp)) fs.rmSync(entry.tmp, { force: true });
      }
    },
    rollback() {
      rollbackJournal(journal);
    },
  };
}

module.exports = {
  applyTransaction,
};
