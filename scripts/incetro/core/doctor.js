'use strict';

const path = require('path');

const {
  EXIT,
  MIN_NODE_MAJOR,
  nodeMajor,
} = require('../constants');
const { describeConflict, describeDrift } = require('./conflicts');
const { isDirectory, lstatOrNull } = require('./paths');
const { summarize } = require('./ownership');

function issue(severity, code, message, extra = {}) {
  return { severity, code, message, ...extra };
}

function inspectInstallation(context, selection) {
  const issues = [];
  if (nodeMajor(context.nodeVersion) < MIN_NODE_MAJOR) {
    issues.push(issue(
      'error',
      'unsupported-node',
      `Node.js ${MIN_NODE_MAJOR}+ is required. Detected: ${context.nodeVersion}`
    ));
  }
  if (!context.gitAvailable) {
    issues.push(issue('warning', 'git-unavailable', 'Git is not available. Explicit project paths still work.'));
  }
  if (!isDirectory(context.projectRoot)) {
    issues.push(issue('error', 'missing-project-root', `Project root does not exist: ${context.projectRoot}`));
  }
  if (context.target.requiredDirectory) {
    const required = path.join(context.projectRoot, context.target.requiredDirectory);
    if (!isDirectory(required)) {
      issues.push(issue(
        'error',
        'missing-target-directory',
        `Missing ${context.target.label} directory: ${context.target.requiredDirectory}`
      ));
    }
  }

  const compatibility = context.adapter.checkCompatibility();
  if (!compatibility.ok) {
    issues.push(issue(
      'error',
      'ecc-incompatible',
      context.adapter.formatCompatibility
        ? context.adapter.formatCompatibility(compatibility)
        : 'ECC compatibility check failed.'
    ));
  } else {
    const eccDoctor = context.adapter.doctor({
      projectRoot: context.projectRoot,
      target: context.target.id,
      homeDir: context.homeDir,
    });
    if (eccDoctor.status === 'absent') {
      issues.push(issue('error', 'missing-ecc-state', 'ECC install-state was not found for this project.'));
    }
    for (const eccIssue of eccDoctor.issues || []) {
      if (eccIssue.code === 'drifted-managed-files') continue;
      issues.push(issue(eccIssue.severity, eccIssue.code, eccIssue.message, { paths: eccIssue.paths || [] }));
    }
    if ((eccDoctor.driftedPaths || []).length > 0) {
      issues.push(issue('error', 'drift', 'ECC-managed files were modified locally.', {
        paths: eccDoctor.driftedPaths,
      }));
    }
  }

  if (!context.state) {
    issues.push(issue('error', 'missing-incetro-state', 'Incetro state was not found. Run incetro-ecc init.'));
  } else {
    if (context.state.target !== context.target.id) {
      issues.push(issue(
        'error',
        'target-mismatch',
        `State target is ${context.state.target}. Config target is ${context.target.id}.`
      ));
    }
    if (context.state.incetro.version !== context.incetroVersion) {
      issues.push(issue(
        'warning',
        'stale-state',
        `Installed Incetro ${context.state.incetro.version} differs from CLI ${context.incetroVersion}. Run incetro-ecc update.`
      ));
    }
    if (context.state.profile !== selection.selection.id) {
      issues.push(issue(
        'warning',
        'profile-differs',
        `State profile is ${context.state.profile}. Requested profile is ${selection.selection.id}.`
      ));
    }
  }

  const summary = summarize(selection.entries);
  if (summary.conflicting.length > 0) {
    issues.push(issue('error', 'conflict', 'Incetro destinations collide with existing files.', {
      paths: summary.conflicting.map(describeConflict),
    }));
  }
  if (summary.drifted.length > 0) {
    issues.push(issue('error', 'drift', 'Incetro-managed files were modified locally.', {
      paths: summary.drifted.map(describeDrift),
    }));
  }
  if (summary.missing.length > 0) {
    issues.push(issue('error', 'missing-incetro-files', 'Incetro-managed files are missing.', {
      paths: summary.missing.map(entry => entry.destinationRelative),
    }));
  }

  const destinations = new Set();
  for (const entry of selection.entries) {
    if (!entry.destinationRelative || entry.status === 'removed' || entry.status === 'removed-missing') continue;
    const key = entry.destinationRelative.toLowerCase();
    if (destinations.has(key)) {
      issues.push(issue('error', 'duplicate-rules', `Duplicate destination: ${entry.destinationRelative}`));
    }
    destinations.add(key);
    if (entry.absolute) {
      const stat = lstatOrNull(entry.absolute);
      if (stat && stat.isSymbolicLink()) {
        issues.push(issue('error', 'broken-symlink', `Managed path is a symlink: ${entry.destinationRelative}`));
      }
    }
  }

  return {
    issues,
    summary,
    exitCode: exitCodeFor(issues),
  };
}

function exitCodeFor(issues) {
  const errors = issues.filter(item => item.severity === 'error');
  if (errors.length === 0) return EXIT.OK;
  const codes = new Set(errors.map(item => item.code));
  const unhealthy = [...codes].some(code => !['conflict', 'drift'].includes(code));
  if (unhealthy) return EXIT.UNHEALTHY;
  if (codes.has('conflict')) return EXIT.CONFLICT;
  if (codes.has('drift')) return EXIT.DRIFT;
  return EXIT.UNHEALTHY;
}

module.exports = {
  exitCodeFor,
  inspectInstallation,
};
