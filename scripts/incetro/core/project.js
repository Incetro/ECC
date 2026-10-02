'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { EXIT, IncetroError } = require('../constants');
const { gitEnv, isDirectory } = require('./paths');

function detectGitRoot(startDir) {
  const result = spawnSync('git', ['-C', startDir, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    env: gitEnv(),
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) return null;
  const root = (result.stdout || '').trim();
  if (!root) return null;
  return path.resolve(root);
}

function canonicalize(dir) {
  const resolved = path.resolve(dir);
  try {
    return fs.realpathSync(resolved);
  } catch (_error) {
    return resolved;
  }
}

/**
 * Project root resolution:
 * 1. Explicit path argument, used exactly (never walked upward).
 * 2. Git root of the working directory.
 * 3. Working directory.
 * @param {{ cwd: string, explicitPath?: string|null }} options
 */
function resolveProjectRoot(options) {
  const cwd = canonicalize(options.cwd || process.cwd());
  if (options.explicitPath) {
    const resolved = path.resolve(options.cwd || process.cwd(), options.explicitPath);
    if (!isDirectory(resolved) && !isDirectory(canonicalize(resolved))) {
      throw new IncetroError(
        `Project path is not a directory: ${resolved}`,
        EXIT.CONFIG
      );
    }
    return canonicalize(resolved);
  }

  return canonicalize(detectGitRoot(cwd) || cwd);
}

function projectName(projectRoot) {
  return path.basename(projectRoot);
}

function gitAvailable() {
  const result = spawnSync('git', ['--version'], {
    encoding: 'utf8',
    env: gitEnv(),
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return !result.error && result.status === 0;
}

function readGitCommit(repoRoot) {
  const result = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    env: gitEnv(),
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) return null;
  const commit = (result.stdout || '').trim();
  return commit || null;
}

module.exports = {
  detectGitRoot,
  resolveProjectRoot,
  projectName,
  gitAvailable,
  readGitCommit,
};
