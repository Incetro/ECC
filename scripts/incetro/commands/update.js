'use strict';

const { EXIT } = require('../constants');
const { describeConflict, describeDrift } = require('../core/conflicts');
const { createContext, requireState, resolveProjectSelection } = require('../core/context');
const { inspectInstallation } = require('../core/doctor');
const { applyManagedChanges, snapshotRules } = require('../core/overlay');
const { summarize } = require('../core/ownership');

function run(options) {
  const context = createContext(options);
  if (!options.json) process.stderr.write(`Project: ${context.projectRoot}\n`);
  requireState(context);
  const opened = resolveProjectSelection(context, options);
  const summary = summarize(opened.entries);
  const eccDoctor = context.adapter.doctor({
    projectRoot: context.projectRoot,
    target: context.target.id,
    homeDir: context.homeDir,
  });
  const eccDrift = eccDoctor.driftedPaths || [];
  const flags = {
    keepLocal: Boolean(options.keepLocal),
    acceptIncetro: Boolean(options.acceptIncetro),
  };
  const incetroDrift = summary.drifted.length > 0 || eccDrift.length > 0;
  if (summary.conflicting.length > 0) {
    return blocked(context, opened, summary, eccDrift, EXIT.CONFLICT, 'Conflicts were left unchanged.');
  }
  if (incetroDrift && !flags.keepLocal && !flags.acceptIncetro) {
    return blocked(context, opened, summary, eccDrift, EXIT.DRIFT, driftMessage(summary.drifted, eccDrift));
  }

  const beforeRules = snapshotRules(context.projectRoot);
  const skipEcc = eccDrift.length > 0 && flags.keepLocal;
  let eccInstall = { changed: 0, operationCount: 0, warnings: [] };
  if (!skipEcc) {
    eccInstall = context.adapter.install({
      projectRoot: context.projectRoot,
      target: context.target.id,
      profileId: opened.selection.ecc.profile,
      skillIds: opened.selection.ecc.skills,
      moduleIds: opened.selection.ecc.modules,
      hooks: opened.selection.ecc.hooks,
      dryRun: false,
      homeDir: context.homeDir,
    });
  }

  const planned = resolveProjectSelection(context, options);
  const plannedSummary = summarize(planned.entries);
  if (plannedSummary.conflicting.length > 0) {
    return blocked(context, planned, plannedSummary, eccDrift, EXIT.CONFLICT, 'Conflicts were left unchanged.');
  }
  applyManagedChanges(context, planned.entries, {
    ...flags,
    profileId: opened.selection.id,
  });

  const refreshed = createContext(options);
  const refreshedSelection = resolveProjectSelection(refreshed, options);
  const health = inspectInstallation(refreshed, refreshedSelection);
  const written = new Set(planned.desired.map(file => file.destinationRelative));
  const updated = plannedSummary.new.length
    + plannedSummary.missing.length
    + plannedSummary.outdated.length
    + (flags.acceptIncetro ? plannedSummary.drifted.filter(entry => entry.sourceAbsolute).length : 0);
  const exitCode = flags.keepLocal && health.exitCode === EXIT.DRIFT ? EXIT.OK : health.exitCode;

  return {
    exitCode,
    result: {
      type: 'update',
      ok: exitCode === EXIT.OK,
      blocked: false,
      projectRoot: context.projectRoot,
      projectName: context.projectName,
      profile: opened.selection.id,
      eccChanged: skipEcc ? 0 : eccInstall.changed,
      incetroUpdated: updated,
      incetroUnchanged: plannedSummary['up-to-date'].length,
      preservedProjectFiles: beforeRules.filter(relative => !written.has(relative)).length,
      conflicts: 0,
      drift: flags.acceptIncetro ? 0 : plannedSummary.drifted.length,
      warnings: eccInstall.warnings || [],
      message: exitCode === EXIT.OK ? 'Updated.' : 'Update finished with doctor findings.',
    },
  };
}

function blocked(context, opened, summary, eccDrift, exitCode, message) {
  return {
    exitCode,
    result: {
      type: 'update',
      ok: false,
      blocked: true,
      projectRoot: context.projectRoot,
      projectName: context.projectName,
      profile: opened.selection.id,
      eccChanged: 0,
      incetroUpdated: 0,
      incetroUnchanged: summary['up-to-date'].length,
      preservedProjectFiles: summary.conflicting.length,
      conflicts: summary.conflicting.length + 0,
      drift: summary.drifted.length + eccDrift.length,
      files: [
        ...summary.drifted.map(entry => ({ status: 'drifted', destination: entry.destinationRelative })),
        ...summary.conflicting.map(entry => ({ status: 'conflicting', destination: describeConflict(entry) })),
        ...eccDrift.map(destination => ({ status: 'drifted', destination })),
      ],
      message,
    },
  };
}

function driftMessage(entries, eccDrift) {
  const paths = [
    ...entries.map(describeDrift),
    ...eccDrift,
  ];
  return [
    'Incetro-managed file was modified locally:',
    ...paths,
    '',
    'Use:',
    'incetro-ecc update --keep-local',
    'incetro-ecc update --accept-incetro',
  ].join('\n');
}

module.exports = { run };
