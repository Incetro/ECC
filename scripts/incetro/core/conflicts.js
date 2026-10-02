'use strict';

const { summarize } = require('./ownership');

function findConflicts(entries) {
  return summarize(entries).conflicting;
}

function describeConflict(entry) {
  if (entry.reason === 'ecc-owned') {
    return `${entry.destinationRelative} is owned by ECC`;
  }
  if (entry.reason === 'symlink') {
    return `${entry.destinationRelative} is a symlink`;
  }
  if (entry.reason === 'duplicate-destination') {
    return `${entry.destinationRelative} is targeted by more than one component`;
  }
  return `${entry.destinationRelative} already exists and is not Incetro-owned`;
}

function describeDrift(entry) {
  return entry.destinationRelative;
}

module.exports = {
  describeConflict,
  describeDrift,
  findConflicts,
};
