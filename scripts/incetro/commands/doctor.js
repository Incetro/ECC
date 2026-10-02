'use strict';

const { createContext, resolveProjectSelection } = require('../core/context');
const { inspectInstallation } = require('../core/doctor');

function run(options) {
  const context = createContext(options);
  if (!options.json) process.stderr.write(`Project: ${context.projectRoot}\n`);
  const profile = context.state ? context.state.profile : (options.profile || null);
  const opened = resolveProjectSelection(context, { profile });
  const health = inspectInstallation(context, opened);
  return {
    exitCode: health.exitCode,
    result: {
      type: 'doctor',
      ok: health.exitCode === 0,
      projectRoot: context.projectRoot,
      projectName: context.projectName,
      issues: health.issues,
      exitCode: health.exitCode,
    },
  };
}

module.exports = { run };
