'use strict';

const { EXIT, IncetroError } = require('../constants');
const { createContext, resolveProjectSelection } = require('../core/context');
const { describeConflict } = require('../core/conflicts');
const { inspectInstallation } = require('../core/doctor');
const { applyManagedChanges, snapshotRules } = require('../core/overlay');
const { summarize } = require('../core/ownership');

function run(options) {
  const context = createContext(options);
  announce(options, context.projectRoot);
  if (context.state) {
    return {
      exitCode: EXIT.OK,
      result: {
        type: 'init',
        ok: true,
        alreadyInitialized: true,
        projectRoot: context.projectRoot,
        projectName: context.projectName,
      },
    };
  }

  const compatibility = context.adapter.checkCompatibility();
  if (!compatibility.ok) {
    throw new IncetroError(context.adapter.formatCompatibility(compatibility), EXIT.FAILURE, compatibility);
  }

  const opened = resolveProjectSelection(context, options);
  const conflicts = summarize(opened.entries).conflicting;
  if (conflicts.length > 0) {
    return conflictResult(context, opened, conflicts);
  }

  const beforeRules = snapshotRules(context.projectRoot);
  const eccInstall = context.adapter.install(installInput(context, opened, false));

  const planned = resolveProjectSelection(context, options);
  const postConflicts = summarize(planned.entries).conflicting;
  if (postConflicts.length > 0) {
    context.adapter.uninstall(installInput(context, opened, true));
    return conflictResult(context, planned, postConflicts);
  }

  try {
    applyManagedChanges(context, planned.entries, {
      acceptIncetro: false,
      keepLocal: false,
      profileId: opened.selection.id,
    });
  } catch (error) {
    try {
      context.adapter.uninstall(installInput(context, opened, true));
    } catch (_uninstallError) {
      throw new IncetroError(
        `${error.message}\nECC files may still be installed. Run incetro-ecc remove --yes after review.`,
        EXIT.FAILURE
      );
    }
    throw error;
  }

  const refreshed = createContext(options);
  const refreshedSelection = resolveProjectSelection(refreshed, options);
  const health = inspectInstallation(refreshed, refreshedSelection);
  const written = new Set(planned.desired.map(file => file.destinationRelative));
  const componentCount = opened.selection.incetro.rules.length
    + opened.selection.incetro.agents.length
    + opened.selection.incetro.skills.length;

  return {
    exitCode: health.exitCode,
    result: {
      type: 'init',
      ok: health.exitCode === EXIT.OK,
      alreadyInitialized: false,
      projectRoot: context.projectRoot,
      projectName: context.projectName,
      profile: opened.selection.id,
      target: context.target.id,
      eccVersion: context.adapter.versions().version,
      incetroVersion: context.incetroVersion,
      eccComponents: eccInstall.operationCount,
      incetroComponents: componentCount,
      preservedProjectFiles: beforeRules.filter(relative => !written.has(relative)).length,
      status: health.exitCode === EXIT.OK ? 'healthy' : 'unhealthy',
      warnings: eccInstall.warnings || [],
      issues: health.issues,
    },
  };
}

function installInput(context, opened, dryRun) {
  return {
    projectRoot: context.projectRoot,
    target: context.target.id,
    profileId: opened.selection.ecc.profile,
    skillIds: opened.selection.ecc.skills,
    moduleIds: opened.selection.ecc.modules,
    hooks: opened.selection.ecc.hooks,
    dryRun,
    homeDir: context.homeDir,
  };
}

function conflictResult(context, opened, conflicts) {
  return {
    exitCode: EXIT.CONFLICT,
    result: {
      type: 'init',
      ok: false,
      alreadyInitialized: false,
      projectRoot: context.projectRoot,
      projectName: context.projectName,
      profile: opened.selection.id,
      target: context.target.id,
      eccVersion: '(not installed)',
      incetroVersion: context.incetroVersion,
      eccComponents: 0,
      incetroComponents: 0,
      preservedProjectFiles: conflicts.length,
      conflicts: conflicts.map(describeConflict),
      status: 'conflict',
      message: 'Conflicting files were left unchanged.',
    },
  };
}

function announce(options, projectRoot) {
  if (!options.json) process.stderr.write(`Project: ${projectRoot}\n`);
}

module.exports = { run };
