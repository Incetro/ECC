'use strict';

function formatHelp() {
  return `Incetro ECC

Usage:
  incetro-ecc init [path] [--profile <id>]
  incetro-ecc update [path] [--keep-local | --accept-incetro]
  incetro-ecc status [path]
  incetro-ecc doctor [path]
  incetro-ecc diff [path]
  incetro-ecc remove [path] [--dry-run | --yes] [--keep-local | --accept-incetro]
  incetro-ecc self-update
  incetro-ecc version
  incetro-ecc help

Global options:
  --json       Print a single JSON object
  --verbose    Include paths and ECC warnings
  --help       Show this help

Exit codes:
  0  success
  1  generic failure
  2  invalid configuration
  3  conflicts detected
  4  drift detected
  5  unhealthy installation
`;
}

function lines(result, verbose) {
  switch (result.type) {
    case 'help':
      return [result.text.trimEnd()];
    case 'version':
      return [
        `Incetro: ${result.incetroVersion}`,
        `ECC upstream: ${result.eccVersion || '(unknown)'}`,
      ];
    case 'init':
      if (result.alreadyInitialized) {
        return [
          'Incetro ECC is already initialized.',
          '',
          'Use:',
          'incetro-ecc update',
        ];
      }
      return [
        result.ok ? 'Incetro ECC initialized' : 'Incetro ECC initialization needs attention',
        '',
        `Project: ${result.projectName}`,
        `Profile: ${result.profile}`,
        `ECC: ${result.eccVersion}`,
        `Incetro: ${result.incetroVersion}`,
        '',
        'Installed:',
        `${result.eccComponents} ECC components`,
        `${result.incetroComponents} Incetro components`,
        '',
        `Existing project rules preserved: ${result.preservedProjectFiles}`,
        '',
        `Status: ${result.status}`,
        ...(result.conflicts && result.conflicts.length ? ['', 'Conflicts:', ...result.conflicts.map(item => `- ${item}`)] : []),
        ...(result.message ? ['', result.message] : []),
        ...(verbose ? detailLines(result) : []),
      ];
    case 'update':
      return [
        'Incetro ECC update',
        '',
        `Project: ${result.projectName}`,
        `Profile: ${result.profile}`,
        '',
        'ECC:',
        `${result.eccChanged} components updated`,
        '',
        'Incetro:',
        `${result.incetroUpdated} files updated`,
        `${result.incetroUnchanged} unchanged`,
        '',
        'Project:',
        `${result.preservedProjectFiles} custom files preserved`,
        '',
        'Conflicts:',
        String(result.conflicts),
        '',
        'Drift:',
        String(result.drift),
        ...(result.blocked ? ['', result.message] : []),
        ...(verbose ? detailLines(result) : []),
      ];
    case 'status':
      return [
        'Incetro ECC',
        '',
        `Project: ${result.projectRoot}`,
        `Target: ${result.targetLabel}`,
        `Profile: ${result.profile}`,
        '',
        `Incetro version: ${result.incetroVersion}`,
        `ECC upstream: ${result.eccVersion}`,
        `Installed: ${result.installedAt}`,
        '',
        `ECC: ${result.eccStatus}`,
        `Incetro overlay: ${result.overlayStatus}`,
        `Project overrides: ${result.projectOverrides}`,
        `Drift: ${result.drift}`,
        `Conflicts: ${result.conflicts}`,
      ];
    case 'doctor':
      return [
        result.ok ? 'Incetro ECC doctor: healthy' : 'Incetro ECC doctor: needs attention',
        '',
        `Project: ${result.projectRoot}`,
        ...result.issues.map(item => `- [${item.severity}] ${item.code}: ${item.message}`),
        ...(result.issues.length === 0 ? ['Checks: passed'] : []),
      ];
    case 'diff':
      return [
        'Incetro ECC diff',
        '',
        `Project: ${result.projectName}`,
        `up-to-date: ${result.counts['up-to-date']}`,
        `outdated: ${result.counts.outdated}`,
        `drifted: ${result.counts.drifted}`,
        `missing: ${result.counts.missing}`,
        `conflicting: ${result.counts.conflicting}`,
        `new: ${result.counts.new}`,
        ...(verbose ? detailLines(result) : []),
      ];
    case 'remove':
      return [
        result.applied ? 'Incetro ECC removed' : 'Incetro ECC remove plan',
        '',
        `Project: ${result.projectName}`,
        `Incetro files: ${result.incetroFiles}`,
        `Project files preserved: ${result.preservedProjectFiles}`,
        result.applied ? 'Applied.' : 'Dry run. Re-run with --yes to remove Incetro-owned files.',
        ...(verbose ? detailLines(result) : []),
      ];
    case 'self-update':
      return [
        result.ok ? 'Incetro ECC self-update complete' : 'Incetro ECC self-update needs a manual step',
        '',
        result.message,
        ...(result.command ? ['', result.command] : []),
      ];
    default:
      return [result.message || 'Done'];
  }
}

function detailLines(result) {
  const details = [];
  for (const file of result.files || []) {
    details.push(`${file.status}: ${file.destination || file.path}`);
  }
  for (const warning of result.warnings || []) {
    details.push(`warning: ${warning}`);
  }
  return details.length > 0 ? ['', ...details] : [];
}

function render(result, options = {}) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${lines(result, options.verbose).join('\n')}\n`);
}

function renderError(error, options = {}) {
  const payload = {
    ok: false,
    type: 'error',
    error: error.message,
    exitCode: error.exitCode || 1,
  };
  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  process.stderr.write(`${error.message}\n`);
  if (options.verbose && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
}

module.exports = {
  formatHelp,
  render,
  renderError,
};
