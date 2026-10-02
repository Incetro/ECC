'use strict';

const { EXIT, IncetroError } = require('../constants');
const cursor = require('./cursor');

const TARGETS = Object.freeze({
  [cursor.id]: cursor,
});

function listTargets() {
  return Object.keys(TARGETS);
}

function getTarget(targetId) {
  const target = TARGETS[targetId];
  if (!target) {
    throw new IncetroError(
      `Unsupported target: ${targetId}. Supported targets: ${listTargets().join(', ')}`,
      EXIT.CONFIG
    );
  }
  return target;
}

module.exports = {
  getTarget,
  listTargets,
};
