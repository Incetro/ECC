'use strict';

const { createContext, resolveProjectSelection } = require('../core/context');
const { exitCodeFor } = require('../core/doctor');
const { summarize } = require('../core/ownership');

function run(options) {
  const context = createContext(options);
  const opened = resolveProjectSelection(context, {
    profile: options.profile || (context.state ? context.state.profile : null),
  });
  const summary = summarize(opened.entries);
  const counts = {
    'up-to-date': summary['up-to-date'].length,
    outdated: summary.outdated.length,
    drifted: summary.drifted.length,
    missing: summary.missing.length,
    conflicting: summary.conflicting.length,
    new: summary.new.length,
  };
  const issues = [];
  if (counts.conflicting > 0) issues.push({ severity: 'error', code: 'conflict' });
  if (counts.drifted > 0) issues.push({ severity: 'error', code: 'drift' });
  if (counts.missing > 0) issues.push({ severity: 'error', code: 'missing-incetro-files' });
  return {
    exitCode: exitCodeFor(issues),
    result: {
      type: 'diff',
      ok: issues.length === 0,
      projectRoot: context.projectRoot,
      projectName: context.projectName,
      counts,
      files: opened.entries.map(entry => ({
        status: entry.status,
        destination: entry.destinationRelative,
      })),
    },
  };
}

module.exports = { run };
