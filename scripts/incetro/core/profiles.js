'use strict';

const fs = require('fs');
const path = require('path');

const { DEFAULT_PROFILE, EXIT, IncetroError } = require('../constants');
const { isRegularFile, lstatOrNull } = require('./paths');
const { ID_PATTERN } = require('./manifest');

const PROFILE_KEYS = new Set(['id', 'description', 'extends', 'ecc', 'incetro']);
const ECC_KEYS = new Set(['profile', 'skills', 'modules', 'hooks']);
const INCETRO_KEYS = new Set(['rules', 'agents', 'skills']);
const DEPENDENCY_FILES = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.cfg', 'setup.py'];
const MAX_TEXT_BYTES = 1024 * 1024;

function emptySelection(id) {
  return {
    id,
    description: '',
    ecc: {
      profile: 'minimal',
      skills: [],
      modules: [],
      hooks: false,
    },
    incetro: {
      rules: [],
      agents: [],
      skills: [],
    },
  };
}

function unique(values) {
  return [...new Set(values)];
}

function readTextIfRegular(filePath) {
  const stat = lstatOrNull(filePath);
  if (!stat || !stat.isFile() || stat.size > MAX_TEXT_BYTES) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function listDependencyFiles(projectRoot) {
  const files = [];
  for (const name of DEPENDENCY_FILES) {
    const filePath = path.join(projectRoot, name);
    if (isRegularFile(filePath)) files.push(filePath);
  }
  const requirementsDir = path.join(projectRoot, 'requirements');
  const dirStat = lstatOrNull(requirementsDir);
  if (dirStat && dirStat.isDirectory()) {
    for (const entry of fs.readdirSync(requirementsDir)) {
      if (!entry.endsWith('.txt')) continue;
      const filePath = path.join(requirementsDir, entry);
      if (isRegularFile(filePath)) files.push(filePath);
    }
  }
  return files;
}

function containsWord(projectRoot, pattern) {
  return listDependencyFiles(projectRoot).some(filePath => {
    const text = readTextIfRegular(filePath);
    return Boolean(text && pattern.test(text));
  });
}

function detectProfile(projectRoot) {
  const signals = [];
  const hasManagePy = isRegularFile(path.join(projectRoot, 'manage.py'));
  const hasDjangoDependency = containsWord(projectRoot, /\bdjango\b/i);
  if (hasManagePy && hasDjangoDependency) {
    signals.push('django');
  } else if (
    isRegularFile(path.join(projectRoot, 'pyproject.toml'))
    || isRegularFile(path.join(projectRoot, 'requirements.txt'))
    || listDependencyFiles(projectRoot).some(filePath => filePath.endsWith('.txt') || filePath.endsWith('pyproject.toml'))
  ) {
    signals.push('python');
  }

  const pubspec = readTextIfRegular(path.join(projectRoot, 'pubspec.yaml'));
  if (pubspec && /(^|\n)\s*flutter\s*:/.test(pubspec)) signals.push('flutter');
  if (isRegularFile(path.join(projectRoot, 'go.mod'))) signals.push('go');

  const hasPackageSwift = isRegularFile(path.join(projectRoot, 'Package.swift'));
  let hasXcodeproj = false;
  const rootStat = lstatOrNull(projectRoot);
  if (rootStat && rootStat.isDirectory()) {
    hasXcodeproj = fs.readdirSync(projectRoot, { withFileTypes: true }).some(entry => (
      entry.isDirectory() && entry.name.endsWith('.xcodeproj')
    ));
  }
  if (hasPackageSwift || hasXcodeproj) signals.push('ios');
  if (isRegularFile(path.join(projectRoot, 'package.json'))) signals.push('web');

  if (signals.length === 1) {
    return { profile: signals[0], signals, confident: true };
  }
  return { profile: DEFAULT_PROFILE, signals, confident: signals.length === 0 };
}

function assertStringList(value, label) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !ID_PATTERN.test(item))) {
    throw new IncetroError(`${label} must be an array of component ids.`, EXIT.CONFIG);
  }
  return unique(value);
}

function normalizeProfile(raw, filePath) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new IncetroError(`Profile ${filePath} must be a JSON object.`, EXIT.CONFIG);
  }
  const unknown = Object.keys(raw).filter(key => !PROFILE_KEYS.has(key));
  if (unknown.length > 0) {
    throw new IncetroError(`Unknown profile keys in ${filePath}: ${unknown.join(', ')}`, EXIT.CONFIG);
  }
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    throw new IncetroError(`Profile ${filePath} has an invalid id.`, EXIT.CONFIG);
  }
  const expectedId = path.basename(filePath, '.json');
  if (raw.id !== expectedId) {
    throw new IncetroError(`Profile id ${raw.id} does not match filename ${expectedId}.json`, EXIT.CONFIG);
  }
  const profile = emptySelection(raw.id);
  profile.description = typeof raw.description === 'string' ? raw.description : '';
  profile.extends = Array.isArray(raw.extends) ? assertStringList(raw.extends, `${raw.id} extends`) : [];
  if (raw.extends && !Array.isArray(raw.extends)) {
    throw new IncetroError(`Profile ${raw.id} extends must be an array.`, EXIT.CONFIG);
  }

  const ecc = raw.ecc || {};
  if (typeof ecc !== 'object' || Array.isArray(ecc)) {
    throw new IncetroError(`Profile ${raw.id} ecc must be an object.`, EXIT.CONFIG);
  }
  const unknownEcc = Object.keys(ecc).filter(key => !ECC_KEYS.has(key));
  if (unknownEcc.length > 0) {
    throw new IncetroError(`Unknown ecc keys in profile ${raw.id}: ${unknownEcc.join(', ')}`, EXIT.CONFIG);
  }
  if (ecc.profile) {
    if (typeof ecc.profile !== 'string' || !ID_PATTERN.test(ecc.profile)) {
      throw new IncetroError(`Profile ${raw.id} has an invalid ECC profile.`, EXIT.CONFIG);
    }
    profile.ecc.profile = ecc.profile;
  }
  profile.ecc.skills = ecc.skills ? assertStringList(ecc.skills, `${raw.id} ecc.skills`) : [];
  profile.ecc.modules = ecc.modules ? assertStringList(ecc.modules, `${raw.id} ecc.modules`) : [];
  profile.ecc.hooks = ecc.hooks === true;
  if (ecc.hooks !== undefined && typeof ecc.hooks !== 'boolean') {
    throw new IncetroError(`Profile ${raw.id} ecc.hooks must be a boolean.`, EXIT.CONFIG);
  }

  const incetro = raw.incetro || {};
  if (typeof incetro !== 'object' || Array.isArray(incetro)) {
    throw new IncetroError(`Profile ${raw.id} incetro must be an object.`, EXIT.CONFIG);
  }
  const unknownIncetro = Object.keys(incetro).filter(key => !INCETRO_KEYS.has(key));
  if (unknownIncetro.length > 0) {
    throw new IncetroError(`Unknown incetro keys in profile ${raw.id}: ${unknownIncetro.join(', ')}`, EXIT.CONFIG);
  }
  profile.incetro.rules = incetro.rules ? assertStringList(incetro.rules, `${raw.id} rules`) : [];
  profile.incetro.agents = incetro.agents ? assertStringList(incetro.agents, `${raw.id} agents`) : [];
  profile.incetro.skills = incetro.skills ? assertStringList(incetro.skills, `${raw.id} skills`) : [];
  return profile;
}

function loadProfileFile(sourceRoot, profileId) {
  const filePath = path.join(sourceRoot, 'incetro', 'profiles', `${profileId}.json`);
  if (!isRegularFile(filePath)) {
    throw new IncetroError(`Unknown Incetro profile: ${profileId}`, EXIT.CONFIG);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new IncetroError(`Malformed profile ${profileId}: ${error.message}`, EXIT.CONFIG);
  }
  return normalizeProfile(parsed, filePath);
}

function mergeSelection(base, next) {
  return {
    id: next.id,
    description: next.description || base.description,
    ecc: {
      profile: next.ecc.profile || base.ecc.profile,
      skills: unique([...base.ecc.skills, ...next.ecc.skills]),
      modules: unique([...base.ecc.modules, ...next.ecc.modules]),
      hooks: base.ecc.hooks || next.ecc.hooks,
    },
    incetro: {
      rules: unique([...base.incetro.rules, ...next.incetro.rules]),
      agents: unique([...base.incetro.agents, ...next.incetro.agents]),
      skills: unique([...base.incetro.skills, ...next.incetro.skills]),
    },
  };
}

function resolveProfileChain(sourceRoot, profileId, visiting = new Set()) {
  if (visiting.has(profileId)) {
    throw new IncetroError(
      `Profile inheritance cycle: ${[...visiting, profileId].join(' -> ')}`,
      EXIT.CONFIG
    );
  }
  const profile = loadProfileFile(sourceRoot, profileId);
  visiting.add(profileId);
  let resolved = emptySelection(profileId);
  for (const parentId of profile.extends) {
    resolved = mergeSelection(resolved, resolveProfileChain(sourceRoot, parentId, visiting));
  }
  visiting.delete(profileId);
  resolved = mergeSelection(resolved, profile);
  resolved.id = profileId;
  resolved.description = profile.description;
  return resolved;
}

function applyIncludeExclude(resolved, catalog, config) {
  const selection = {
    ...resolved,
    ecc: { ...resolved.ecc, skills: [...resolved.ecc.skills], modules: [...resolved.ecc.modules] },
    incetro: {
      rules: [...resolved.incetro.rules],
      agents: [...resolved.incetro.agents],
      skills: [...resolved.incetro.skills],
    },
  };

  for (const id of config.include || []) {
    const component = catalog.byId.get(id);
    if (component) {
      const list = selection.incetro[component.kind];
      if (!list.includes(id)) list.push(id);
      continue;
    }
    if (!selection.ecc.skills.includes(id) && !selection.ecc.modules.includes(id)) {
      selection.ecc.skills.push(id);
    }
  }

  const knownIds = new Set([
    ...catalog.byId.keys(),
    ...selection.incetro.rules,
    ...selection.incetro.agents,
    ...selection.incetro.skills,
    ...selection.ecc.skills,
    ...selection.ecc.modules,
  ]);
  for (const id of config.exclude || []) {
    if (!knownIds.has(id)) {
      throw new IncetroError(`Unknown exclude id: ${id}`, EXIT.CONFIG);
    }
  }
  const excluded = new Set(config.exclude || []);
  selection.incetro.rules = selection.incetro.rules.filter(id => !excluded.has(id));
  selection.incetro.agents = selection.incetro.agents.filter(id => !excluded.has(id));
  selection.incetro.skills = selection.incetro.skills.filter(id => !excluded.has(id));
  selection.ecc.skills = selection.ecc.skills.filter(id => !excluded.has(id));
  selection.ecc.modules = selection.ecc.modules.filter(id => !excluded.has(id));
  return selection;
}

function assertIncetroIds(selection, catalog) {
  for (const kind of ['rules', 'agents', 'skills']) {
    for (const id of selection.incetro[kind]) {
      const component = catalog.byId.get(id);
      if (!component || component.kind !== kind) {
        throw new IncetroError(
          `Profile ${selection.id} references missing ${kind.slice(0, -1)}: ${id}`,
          EXIT.CONFIG
        );
      }
    }
  }
}

function resolveSelection(options) {
  const profileId = options.profileId || DEFAULT_PROFILE;
  const resolved = resolveProfileChain(options.sourceRoot, profileId);
  const withConfig = applyIncludeExclude(resolved, options.catalog, options.config || { include: [], exclude: [] });
  assertIncetroIds(withConfig, options.catalog);
  if (options.adapter) {
    options.adapter.assertSelection({
      target: options.target,
      profileId: withConfig.ecc.profile,
      skillIds: withConfig.ecc.skills,
      moduleIds: withConfig.ecc.modules,
    });
  }
  return withConfig;
}

module.exports = {
  detectProfile,
  resolveProfileChain,
  resolveSelection,
  loadProfileFile,
};
