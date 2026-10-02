'use strict';

const fs = require('fs');
const path = require('path');

const EXIT = Object.freeze({
  OK: 0,
  FAILURE: 1,
  CONFIG: 2,
  CONFLICT: 3,
  DRIFT: 4,
  UNHEALTHY: 5,
});

const SCHEMA_VERSION = 1;
const MIN_NODE_MAJOR = 20;
const MIN_ECC_VERSION = '2.0.0';
const STATE_DIR = '.incetro-ecc';
const STATE_FILENAME = 'state.json';
const CONFIG_FILENAME = '.incetro-ecc.json';
const INSTALL_URL = 'git+https://github.com/Incetro/ECC.git';
const UPSTREAM_REMOTE = 'https://github.com/affaan-m/ECC.git';
const INCETRO_TAG_PREFIX = 'incetro-v';
const DEFAULT_TARGET = 'cursor';
const DEFAULT_PROFILE = 'core';

class IncetroError extends Error {
  /**
   * @param {string} message
   * @param {number} [exitCode]
   * @param {object} [details]
   */
  constructor(message, exitCode = EXIT.FAILURE, details = null) {
    super(message);
    this.name = 'IncetroError';
    this.exitCode = exitCode;
    this.details = details;
  }
}

function resolveSourceRoot() {
  return path.resolve(__dirname, '..', '..');
}

function readIncetroVersion(sourceRoot = resolveSourceRoot()) {
  const versionPath = path.join(sourceRoot, 'incetro', 'VERSION');
  let text;
  try {
    text = fs.readFileSync(versionPath, 'utf8');
  } catch (error) {
    throw new IncetroError(
      `Incetro version file is missing at incetro/VERSION (${error.message}).`,
      EXIT.UNHEALTHY
    );
  }
  const version = text.trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new IncetroError(
      `Incetro version must be SemVer. Detected: ${version || '(empty)'}`,
      EXIT.UNHEALTHY
    );
  }
  return version;
}

function compareSemver(left, right) {
  const parse = value => String(value || '0.0.0')
    .split(/[.-]/)
    .slice(0, 3)
    .map(part => {
      const match = /^(\d+)/.exec(part);
      return match ? Number(match[1]) : 0;
    });
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function nodeMajor(version = process.versions.node) {
  return Number(String(version).split('.')[0]);
}

module.exports = {
  EXIT,
  SCHEMA_VERSION,
  MIN_NODE_MAJOR,
  MIN_ECC_VERSION,
  STATE_DIR,
  STATE_FILENAME,
  CONFIG_FILENAME,
  INSTALL_URL,
  UPSTREAM_REMOTE,
  INCETRO_TAG_PREFIX,
  DEFAULT_TARGET,
  DEFAULT_PROFILE,
  IncetroError,
  resolveSourceRoot,
  readIncetroVersion,
  compareSemver,
  nodeMajor,
};
