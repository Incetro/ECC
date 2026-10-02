'use strict';

const { EXIT } = require('../constants');
const { createEccAdapter } = require('../core/ecc-adapter');
const { readIncetroVersion, resolveSourceRoot } = require('../constants');

function run(options) {
  const sourceRoot = (options.dependencies && options.dependencies.sourceRoot) || resolveSourceRoot();
  const incetroVersion = (options.dependencies && options.dependencies.incetroVersion)
    || readIncetroVersion(sourceRoot);
  let eccVersion = null;
  try {
    const adapter = (options.dependencies && options.dependencies.adapter)
      || createEccAdapter({ sourceRoot });
    eccVersion = adapter.versions().version;
  } catch (_error) {
    eccVersion = null;
  }
  return {
    exitCode: EXIT.OK,
    result: {
      type: 'version',
      ok: true,
      incetroVersion,
      eccVersion,
    },
  };
}

module.exports = { run };
