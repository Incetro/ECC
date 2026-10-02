'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  EXIT,
  INSTALL_URL,
  IncetroError,
  resolveSourceRoot,
} = require('../constants');

function run(options) {
  const sourceRoot = (options.dependencies && options.dependencies.sourceRoot) || resolveSourceRoot();
  const kind = detectInstallKind(sourceRoot);
  const command = `npm install -g ${INSTALL_URL}`;
  if (kind !== 'npm') {
    return {
      exitCode: EXIT.FAILURE,
      result: {
        type: 'self-update',
        ok: false,
        mode: kind,
        command,
        message: [
          'This Incetro ECC checkout is running from source.',
          'Update it by pulling the repository, or reinstall the global CLI:',
        ].join('\n'),
      },
    };
  }

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmBin, ['install', '-g', INSTALL_URL], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.error || result.status !== 0) {
    const detail = `${result.stderr || ''}\n${result.stdout || ''}\n${result.error ? result.error.message : ''}`;
    const permission = /EACCES|EPERM|permission denied/i.test(detail);
    if (permission || (result.error && result.error.code === 'EACCES')) {
      return {
        exitCode: EXIT.FAILURE,
        result: {
          type: 'self-update',
          ok: false,
          mode: kind,
          command,
          message: 'Automatic self-update failed because npm does not have permission to update the global install. Run this command:',
        },
      };
    }
    throw new IncetroError(
      `Self-update failed. Run this command:\n${command}`,
      EXIT.FAILURE
    );
  }
  if (options.verbose && result.stdout) {
    process.stderr.write(result.stdout);
  }
  return {
    exitCode: EXIT.OK,
    result: {
      type: 'self-update',
      ok: true,
      mode: kind,
      command,
      message: 'The global Incetro ECC CLI was reinstalled.',
    },
  };
}

function detectInstallKind(sourceRoot) {
  let real = sourceRoot;
  try {
    real = fs.realpathSync(sourceRoot);
  } catch (_error) {
    real = sourceRoot;
  }
  const normalized = real.split(path.sep).join('/');
  if (normalized.includes('/node_modules/')) return 'npm';
  return 'source';
}

module.exports = {
  detectInstallKind,
  run,
};
