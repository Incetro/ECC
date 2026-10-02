'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  EXIT,
  IncetroError,
  SCHEMA_VERSION,
  STATE_DIR,
  STATE_FILENAME,
} = require('../constants');
const { isSha256 } = require('./hashes');
const {
  assertContained,
  isRegularFile,
  lstatOrNull,
  mkdirContained,
} = require('./paths');

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function statePath(projectRoot) {
  return path.join(projectRoot, STATE_DIR, STATE_FILENAME);
}

function validateRelative(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new IncetroError(`State ${label} must be a relative path.`, EXIT.CONFIG);
  }
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new IncetroError(`State ${label} must stay inside the project: ${value}`, EXIT.CONFIG);
  }
  const segments = value.split(/[/\\]+/).filter(Boolean);
  if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
    throw new IncetroError(`State ${label} escapes the project: ${value}`, EXIT.CONFIG);
  }
  return segments.join('/');
}

function validateState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new IncetroError('Incetro state is malformed.', EXIT.CONFIG);
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw new IncetroError(`Unsupported Incetro state schema: ${raw.schemaVersion}`, EXIT.CONFIG);
  }
  for (const key of ['installedAt', 'updatedAt']) {
    if (typeof raw[key] !== 'string' || Number.isNaN(Date.parse(raw[key]))) {
      throw new IncetroError(`State ${key} must be an ISO timestamp.`, EXIT.CONFIG);
    }
  }
  for (const side of ['incetro', 'upstream']) {
    const block = raw[side];
    if (!block || typeof block !== 'object') {
      throw new IncetroError(`State ${side} metadata is missing.`, EXIT.CONFIG);
    }
    if (typeof block.version !== 'string' || block.version.length === 0) {
      throw new IncetroError(`State ${side}.version is missing.`, EXIT.CONFIG);
    }
    if (block.commit !== null && typeof block.commit !== 'string') {
      throw new IncetroError(`State ${side}.commit must be a string or null.`, EXIT.CONFIG);
    }
  }
  if (typeof raw.target !== 'string' || typeof raw.profile !== 'string' || !ID_PATTERN.test(raw.profile)) {
    throw new IncetroError('State target or profile is invalid.', EXIT.CONFIG);
  }
  if (!Array.isArray(raw.files)) {
    throw new IncetroError('State files must be an array.', EXIT.CONFIG);
  }
  const destinations = new Set();
  const files = raw.files.map(file => {
    if (!file || typeof file !== 'object') {
      throw new IncetroError('State file entry is malformed.', EXIT.CONFIG);
    }
    const source = validateRelative(file.source, 'source');
    const destination = validateRelative(file.destination, 'destination');
    if (destinations.has(destination)) {
      throw new IncetroError(`State lists duplicate destination: ${destination}`, EXIT.CONFIG);
    }
    destinations.add(destination);
    if (!isSha256(file.sha256)) {
      throw new IncetroError(`State hash is invalid for ${destination}`, EXIT.CONFIG);
    }
    if (file.owner !== 'incetro') {
      throw new IncetroError(`State owner must be incetro for ${destination}`, EXIT.CONFIG);
    }
    if (typeof file.version !== 'string') {
      throw new IncetroError(`State version is missing for ${destination}`, EXIT.CONFIG);
    }
    return {
      source,
      destination,
      sha256: file.sha256,
      owner: 'incetro',
      version: file.version,
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    installedAt: raw.installedAt,
    updatedAt: raw.updatedAt,
    incetro: {
      version: raw.incetro.version,
      commit: raw.incetro.commit,
    },
    upstream: {
      version: raw.upstream.version,
      commit: raw.upstream.commit,
    },
    target: raw.target,
    profile: raw.profile,
    files,
  };
}

function migrateState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new IncetroError('Incetro state is malformed.', EXIT.CONFIG);
  }
  if (typeof raw.schemaVersion !== 'number') {
    throw new IncetroError('Incetro state schema is missing.', EXIT.CONFIG);
  }
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new IncetroError(
      `Incetro state schema ${raw.schemaVersion} is newer than this CLI (supports ${SCHEMA_VERSION}). Run incetro-ecc self-update.`,
      EXIT.CONFIG
    );
  }
  let state = raw;
  let version = raw.schemaVersion;
  while (version < SCHEMA_VERSION) {
    throw new IncetroError(`No migration from Incetro state schema ${version}.`, EXIT.CONFIG);
  }
  return validateState(state);
}

function readState(projectRoot) {
  const filePath = statePath(projectRoot);
  if (!isRegularFile(filePath)) {
    const stat = lstatOrNull(filePath);
    if (stat) {
      throw new IncetroError(`Incetro state is not a regular file: ${filePath}`, EXIT.CONFIG);
    }
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new IncetroError(`Malformed Incetro state: ${error.message}`, EXIT.CONFIG);
  }
  const state = migrateState(parsed);
  for (const file of state.files) {
    assertContained(projectRoot, path.join(projectRoot, ...file.destination.split('/')));
  }
  return state;
}

function writeState(projectRoot, state) {
  const validated = validateState(state);
  const target = statePath(projectRoot);
  mkdirContained(projectRoot, path.dirname(target));
  const token = crypto.randomBytes(4).toString('hex');
  const tmp = path.join(path.dirname(target), `.${STATE_FILENAME}.${token}.tmp`);
  fs.writeFileSync(tmp, `${JSON.stringify(validated, null, 2)}\n`);
  const existing = lstatOrNull(target);
  if (existing && existing.isSymbolicLink()) {
    fs.rmSync(tmp, { force: true });
    throw new IncetroError(`Refusing to replace symlink state file: ${target}`, EXIT.CONFIG);
  }
  const backup = `${target}.${token}.bak`;
  if (existing) fs.renameSync(target, backup);
  try {
    fs.renameSync(tmp, target);
  } catch (error) {
    if (existing) fs.renameSync(backup, target);
    fs.rmSync(tmp, { force: true });
    throw error;
  }
  if (existing) fs.rmSync(backup, { force: true });
  return target;
}

function removeState(projectRoot) {
  const target = statePath(projectRoot);
  const stat = lstatOrNull(target);
  if (!stat) return false;
  if (!stat.isFile()) {
    throw new IncetroError(`Refusing to delete non-file state: ${target}`, EXIT.CONFIG);
  }
  fs.rmSync(target, { force: true });
  const dir = path.dirname(target);
  const remaining = fs.readdirSync(dir).filter(name => !name.endsWith('.tmp') && !name.endsWith('.bak'));
  if (remaining.length === 0) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return true;
}

module.exports = {
  migrateState,
  readState,
  removeState,
  statePath,
  validateState,
  writeState,
};
