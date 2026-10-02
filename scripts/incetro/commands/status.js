'use strict';

const path = require('path');

const { EXIT } = require('../constants');
const { createContext, resolveProjectSelection } = require('../core/context');
const { inspectInstallation } = require('../core/doctor');
const { snapshotRules } = require('../core/overlay');
const { summarize } = require('../core/ownership');
const { toPosix } = require('../core/paths');

function run(options) {
  const context = createContext(options);
  if (!context.state) {
    return {
      exitCode: EXIT.UNHEALTHY,
      result: {
        type: 'status',
        ok: false,
        projectRoot: context.projectRoot,
        targetLabel: context.target.label,
        profile: '(not initialized)',
        incetroVersion: context.incetroVersion,
        eccVersion: safeVersion(context),
        installedAt: '(not installed)',
        eccStatus: 'missing',
        overlayStatus: 'missing',
        projectOverrides: 0,
        drift: 0,
        conflicts: 0,
        message: 'Incetro ECC is not initialized in this project.',
      },
    };
  }
  const opened = resolveProjectSelection(context, { profile: context.state.profile });
  const health = inspectInstallation(context, opened);
  const summary = summarize(opened.entries);
  const managed = new Set(opened.desired.map(file => file.destinationRelative));
  for (const absolute of context.adapter.listManagedPaths({
    projectRoot: context.projectRoot,
    target: context.target.id,
    homeDir: context.homeDir,
  })) {
    managed.add(toPosix(path.relative(context.projectRoot, absolute)));
  }
  const projectOverrides = snapshotRules(context.projectRoot)
    .filter(relative => !managed.has(relative))
    .length;
  const eccIssue = health.issues.find(item => item.code === 'missing-ecc-state' || item.code === 'ecc-incompatible');
  const overlayErrors = health.issues.filter(item => (
    item.severity === 'error' && !String(item.code).startsWith('ecc') && item.code !== 'drift' && item.code !== 'conflict'
  ));
  return {
    exitCode: EXIT.OK,
    result: {
      type: 'status',
      ok: true,
      projectRoot: context.projectRoot,
      targetLabel: context.target.label,
      profile: context.state.profile,
      incetroVersion: context.state.incetro.version,
      eccVersion: context.state.upstream.version,
      installedAt: context.state.installedAt.slice(0, 10),
      eccStatus: eccIssue ? 'unhealthy' : 'healthy',
      overlayStatus: overlayErrors.length > 0 ? 'unhealthy' : 'healthy',
      projectOverrides,
      drift: summary.drifted.length,
      conflicts: summary.conflicting.length,
      issues: health.issues,
    },
  };
}

function safeVersion(context) {
  try {
    return context.adapter.versions().version || '(unknown)';
  } catch (_error) {
    return '(unknown)';
  }
}

module.exports = { run };
