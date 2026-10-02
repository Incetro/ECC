'use strict';

const fs = require('fs');
const path = require('path');

const {
  CONFIG_FILENAME,
  DEFAULT_PROFILE,
  DEFAULT_TARGET,
  EXIT,
  IncetroError,
} = require('../constants');
const { isRegularFile, lstatOrNull } = require('./paths');

const ALLOWED_KEYS = new Set(['target', 'profile', 'autoDetectProfile', 'exclude', 'include']);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/;

function defaultConfig() {
  return {
    target: DEFAULT_TARGET,
    profile: null,
    autoDetectProfile: true,
    exclude: [],
    include: [],
    path: null,
  };
}

function assertIdList(value, label) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new IncetroError(`${label} must be an array of strings.`, EXIT.CONFIG);
  }
  const normalized = [];
  for (const item of value) {
    const id = item.trim();
    if (!ID_PATTERN.test(id) || id.includes('..')) {
      throw new IncetroError(`Invalid ${label} entry: ${item}`, EXIT.CONFIG);
    }
    normalized.push(id);
  }
  return [...new Set(normalized)];
}

function parseConfig(text, filePath) {
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new IncetroError(
      `Malformed project config ${filePath}: ${error.message}`,
      EXIT.CONFIG
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new IncetroError(`Project config ${filePath} must be a JSON object.`, EXIT.CONFIG);
  }

  const unknown = Object.keys(parsed).filter(key => !ALLOWED_KEYS.has(key));
  if (unknown.length > 0) {
    throw new IncetroError(
      `Unknown project config keys: ${unknown.join(', ')}. Allowed keys: ${[...ALLOWED_KEYS].join(', ')}`,
      EXIT.CONFIG
    );
  }

  const config = defaultConfig();
  config.path = filePath;
  if (Object.prototype.hasOwnProperty.call(parsed, 'target')) {
    if (typeof parsed.target !== 'string' || parsed.target.trim() === '') {
      throw new IncetroError('Config target must be a non-empty string.', EXIT.CONFIG);
    }
    config.target = parsed.target.trim();
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'profile')) {
    if (parsed.profile !== null && (typeof parsed.profile !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(parsed.profile))) {
      throw new IncetroError(`Invalid profile in config: ${parsed.profile}`, EXIT.CONFIG);
    }
    config.profile = parsed.profile;
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'autoDetectProfile')) {
    if (typeof parsed.autoDetectProfile !== 'boolean') {
      throw new IncetroError('Config autoDetectProfile must be a boolean.', EXIT.CONFIG);
    }
    config.autoDetectProfile = parsed.autoDetectProfile;
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'exclude')) {
    config.exclude = assertIdList(parsed.exclude, 'exclude');
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'include')) {
    config.include = assertIdList(parsed.include, 'include');
  }
  return config;
}

function loadConfig(projectRoot) {
  const filePath = path.join(projectRoot, CONFIG_FILENAME);
  const stat = lstatOrNull(filePath);
  if (!stat) return defaultConfig();
  if (!isRegularFile(filePath)) {
    throw new IncetroError(`Project config must be a file: ${filePath}`, EXIT.CONFIG);
  }
  return parseConfig(fs.readFileSync(filePath, 'utf8'), filePath);
}

module.exports = {
  ALLOWED_KEYS,
  DEFAULT_PROFILE,
  defaultConfig,
  loadConfig,
  parseConfig,
};
