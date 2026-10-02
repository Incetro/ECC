'use strict';

const fs = require('fs');
const path = require('path');

const { EXIT, IncetroError } = require('../constants');

function toPosix(value) {
  return String(value || '').split(path.sep).join('/');
}

function lstatOrNull(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function isRegularFile(filePath) {
  const stat = lstatOrNull(filePath);
  return Boolean(stat && stat.isFile());
}

function isDirectory(filePath) {
  const stat = lstatOrNull(filePath);
  return Boolean(stat && stat.isDirectory());
}

function gitEnv() {
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX']) {
    delete env[key];
  }
  return env;
}

/**
 * Join a project root with a forward-slash relative path.
 * Rejects absolute paths and parent traversal.
 * @param {string} projectRoot
 * @param {string} relativePosix
 */
function joinInside(projectRoot, relativePosix) {
  if (typeof relativePosix !== 'string' || relativePosix.length === 0) {
    throw new IncetroError('A relative destination path is required.', EXIT.CONFIG);
  }
  if (path.isAbsolute(relativePosix) || path.win32.isAbsolute(relativePosix)) {
    throw new IncetroError(`Refusing absolute path: ${relativePosix}`, EXIT.CONFIG);
  }
  const segments = relativePosix.split(/[/\\]+/).filter(Boolean);
  if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
    throw new IncetroError(`Refusing path outside project root: ${relativePosix}`, EXIT.CONFIG);
  }
  return path.resolve(projectRoot, ...segments);
}

/**
 * Confirm an absolute path stays inside projectRoot and does not follow
 * a symlink that escapes the root.
 * @param {string} projectRoot
 * @param {string} absolutePath
 */
function assertContained(projectRoot, absolutePath) {
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(absolutePath);
  const relative = path.relative(root, absolute);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new IncetroError(`Refusing path outside project root: ${absolutePath}`, EXIT.CONFIG);
  }

  const segments = relative.split(path.sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stat = lstatOrNull(current);
    if (!stat) break;
    if (stat.isSymbolicLink()) {
      let target;
      try {
        target = fs.realpathSync(current);
      } catch (error) {
        throw new IncetroError(
          `Refusing broken symlink: ${current} (${error.message})`,
          EXIT.CONFIG
        );
      }
      const targetRelative = path.relative(root, target);
      if (
        targetRelative === ''
        || targetRelative.startsWith('..')
        || path.isAbsolute(targetRelative)
      ) {
        throw new IncetroError(`Refusing symlink outside project root: ${current}`, EXIT.CONFIG);
      }
    }
  }

  return {
    absolute,
    relative: toPosix(relative),
  };
}

function mkdirContained(projectRoot, directoryPath) {
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(directoryPath);
  const relative = path.relative(root, absolute);
  if (relative === '') return absolute;
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new IncetroError(`Refusing to create a directory outside project root: ${directoryPath}`, EXIT.CONFIG);
  }

  const segments = relative.split(path.sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stat = lstatOrNull(current);
    if (!stat) {
      fs.mkdirSync(current);
      continue;
    }
    if (stat.isSymbolicLink()) {
      throw new IncetroError(`Refusing to follow symlink: ${current}`, EXIT.CONFIG);
    }
    if (!stat.isDirectory()) {
      throw new IncetroError(`Cannot create a directory because a file exists: ${current}`, EXIT.CONFIG);
    }
  }
  return absolute;
}

function listRelativeFiles(rootDir) {
  const files = [];
  const rootStat = lstatOrNull(rootDir);
  if (!rootStat || !rootStat.isDirectory()) return files;

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push(toPosix(path.relative(rootDir, absolute)));
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

module.exports = {
  toPosix,
  lstatOrNull,
  isRegularFile,
  isDirectory,
  gitEnv,
  joinInside,
  assertContained,
  mkdirContained,
  listRelativeFiles,
};
