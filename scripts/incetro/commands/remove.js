'use strict';

const fs = require('fs');
const path = require('path');

const { EXIT } = require('../constants');
const { describeDrift } = require('../core/conflicts');
const { createContext, requireState, resolveProjectSelection } = require('../core/context');
const { applyManagedChanges } = require('../core/overlay');
const { summarize } = require('../core/ownership');
const { lstatOrNull } = require('../core/paths');
const { removeState } = require('../core/state');

function run(options) {
  const context = createContext(options);
  if (!options.json) process.stderr.write(`Project: ${context.projectRoot}\n`);
  requireState(context);
  const opened = resolveProjectSelection(context, { profile: context.state.profile });
  const summary = summarize(opened.entries);
  const flags = {
    keepLocal: Boolean(options.keepLocal),
    acceptIncetro: Boolean(options.acceptIncetro),
  };
  const dryRun = !options.yes || options.dryRun;
  const owned = [
    ...summary['up-to-date'],
    ...summary.outdated,
    ...summary.missing,
    ...summary.removed,
    ...summary['removed-missing'],
    ...(flags.acceptIncetro ? summary.drifted : []),
  ];
  const preserved = [
    ...summary.conflicting,
    ...(flags.acceptIncetro ? [] : summary.drifted),
  ];
  if (!dryRun && summary.drifted.length > 0 && !flags.keepLocal && !flags.acceptIncetro) {
    return {
      exitCode: EXIT.DRIFT,
      result: {
        type: 'remove',
        ok: false,
        applied: false,
        projectRoot: context.projectRoot,
        projectName: context.projectName,
        incetroFiles: owned.length,
        preservedProjectFiles: preserved.length,
        files: summary.drifted.map(entry => ({ status: 'drifted', destination: describeDrift(entry) })),
        message: [
          'Incetro-managed file was modified locally:',
          ...summary.drifted.map(describeDrift),
          '',
          'Use:',
          'incetro-ecc remove --yes --keep-local',
          'incetro-ecc remove --yes --accept-incetro',
        ].join('\n'),
      },
    };
  }

  if (!dryRun) {
    const applied = applyManagedChanges(context, opened.entries, {
      remove: true,
      keepLocal: flags.keepLocal,
      acceptIncetro: flags.acceptIncetro,
      profileId: context.state.profile,
    });
    if (applied.state.files.length === 0) {
      removeState(context.projectRoot);
    }
    for (const entry of owned) {
      cleanupEmpty(entry.absolute, context.projectRoot);
    }
    const ecc = context.adapter.uninstall({
      projectRoot: context.projectRoot,
      target: context.target.id,
      homeDir: context.homeDir,
      dryRun: false,
    });
    return {
      exitCode: ecc.ok ? EXIT.OK : EXIT.FAILURE,
      result: {
        type: 'remove',
        ok: ecc.ok,
        applied: true,
        projectRoot: context.projectRoot,
        projectName: context.projectName,
        incetroFiles: owned.length,
        preservedProjectFiles: preserved.length,
        warnings: ecc.warnings,
        message: 'Removed Incetro-owned files.',
      },
    };
  }

  const eccPlan = context.adapter.uninstall({
    projectRoot: context.projectRoot,
    target: context.target.id,
    homeDir: context.homeDir,
    dryRun: true,
  });
  return {
    exitCode: EXIT.OK,
    result: {
      type: 'remove',
      ok: true,
      applied: false,
      projectRoot: context.projectRoot,
      projectName: context.projectName,
      incetroFiles: owned.length,
      preservedProjectFiles: preserved.length,
      eccPlanned: eccPlan.removedCount,
      files: owned.map(entry => ({ status: entry.status, destination: entry.destinationRelative })),
      message: 'Dry run. Re-run with --yes to remove Incetro-owned files.',
    },
  };
}

function cleanupEmpty(filePath, projectRoot) {
  if (!filePath) return;
  let current = path.dirname(filePath);
  const root = path.resolve(projectRoot);
  while (current !== root) {
    const relative = path.relative(root, current);
    if (relative.startsWith('..') || path.isAbsolute(relative)) break;
    if (path.basename(current) === '.cursor' || path.basename(current) === '.incetro-ecc') break;
    const stat = lstatOrNull(current);
    if (!stat || !stat.isDirectory()) break;
    if (fs.readdirSync(current).length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

module.exports = { run };
