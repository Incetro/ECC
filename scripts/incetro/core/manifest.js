'use strict';

const fs = require('fs');
const path = require('path');

const { EXIT, IncetroError } = require('../constants');
const { isDirectory, isRegularFile, lstatOrNull, toPosix } = require('./paths');

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const IGNORED_FILE_NAMES = new Set(['README.md', 'readme.md']);

function overlayRoot(sourceRoot) {
  return path.join(sourceRoot, 'incetro');
}

function assertSafeName(name, label) {
  if (!ID_PATTERN.test(name)) {
    throw new IncetroError(`Invalid ${label} name: ${name}`, EXIT.CONFIG);
  }
}

function listFilesRecursive(dirPath, prefix = '') {
  const files = [];
  const stat = lstatOrNull(dirPath);
  if (!stat || !stat.isDirectory()) return files;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new IncetroError(`Refusing symlink in Incetro overlay: ${path.join(dirPath, entry.name)}`, EXIT.CONFIG);
    }
    const relativeInside = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (relativeInside.split('/').some(segment => segment === '.' || segment === '..')) {
      throw new IncetroError(`Refusing overlay path: ${relativeInside}`, EXIT.CONFIG);
    }
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(absolute, relativeInside));
    } else if (entry.isFile()) {
      files.push({
        baseName: entry.name,
        relativeInside: toPosix(relativeInside),
        sourceAbsolute: absolute,
      });
    }
  }
  return files;
}

function addComponent(catalog, component) {
  if (catalog.byId.has(component.id)) {
    throw new IncetroError(
      `Duplicate Incetro component id: ${component.id}`,
      EXIT.CONFIG
    );
  }
  catalog.byId.set(component.id, component);
  catalog[component.kind].push(component);
}

function loadCatalog(sourceRoot) {
  const root = overlayRoot(sourceRoot);
  const catalog = {
    root,
    rules: [],
    agents: [],
    skills: [],
    byId: new Map(),
  };

  const rulesDir = path.join(root, 'rules');
  if (isDirectory(rulesDir)) {
    for (const entry of fs.readdirSync(rulesDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.mdc') || IGNORED_FILE_NAMES.has(entry.name)) continue;
      const id = entry.name.slice(0, -'.mdc'.length);
      assertSafeName(id, 'rule');
      const sourceAbsolute = path.join(rulesDir, entry.name);
      addComponent(catalog, {
        id,
        kind: 'rules',
        files: [{
          baseName: entry.name,
          relativeInside: entry.name,
          sourceAbsolute,
          sourceRelative: toPosix(path.relative(sourceRoot, sourceAbsolute)),
        }],
      });
    }
  }

  const agentsDir = path.join(root, 'agents');
  if (isDirectory(agentsDir)) {
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md') || IGNORED_FILE_NAMES.has(entry.name)) continue;
      const id = entry.name.slice(0, -'.md'.length);
      assertSafeName(id, 'agent');
      const sourceAbsolute = path.join(agentsDir, entry.name);
      addComponent(catalog, {
        id,
        kind: 'agents',
        files: [{
          baseName: entry.name,
          relativeInside: entry.name,
          sourceAbsolute,
          sourceRelative: toPosix(path.relative(sourceRoot, sourceAbsolute)),
        }],
      });
    }
  }

  const skillsDir = path.join(root, 'skills');
  if (isDirectory(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      assertSafeName(entry.name, 'skill');
      const skillDir = path.join(skillsDir, entry.name);
      const skillFile = path.join(skillDir, 'SKILL.md');
      if (!isRegularFile(skillFile)) {
        throw new IncetroError(`Incetro skill ${entry.name} is missing SKILL.md`, EXIT.CONFIG);
      }
      const files = listFilesRecursive(skillDir).map(file => ({
        ...file,
        sourceRelative: toPosix(path.relative(sourceRoot, file.sourceAbsolute)),
      }));
      addComponent(catalog, {
        id: entry.name,
        kind: 'skills',
        files,
      });
    }
  }

  return catalog;
}

module.exports = {
  ID_PATTERN,
  loadCatalog,
  overlayRoot,
};
