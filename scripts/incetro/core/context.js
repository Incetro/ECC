'use strict';

const os = require('os');

const {
  DEFAULT_PROFILE,
  EXIT,
  IncetroError,
  MIN_NODE_MAJOR,
  nodeMajor,
  readIncetroVersion,
  resolveSourceRoot,
} = require('../constants');
const { createEccAdapter } = require('./ecc-adapter');
const { loadConfig } = require('./config');
const { loadCatalog } = require('./manifest');
const { buildDesired } = require('./overlay');
const { classify } = require('./ownership');
const { detectProfile, resolveSelection } = require('./profiles');
const { gitAvailable, projectName, readGitCommit, resolveProjectRoot } = require('./project');
const { readState } = require('./state');
const { getTarget } = require('../targets');

function createContext(options = {}) {
  const dependencies = options.dependencies || {};
  const sourceRoot = dependencies.sourceRoot || resolveSourceRoot();
  const cwd = options.cwd || process.cwd();
  const projectRoot = resolveProjectRoot({
    cwd,
    explicitPath: options.path || null,
  });
  const config = loadConfig(projectRoot);
  const target = getTarget(config.target || 'cursor');
  const catalog = dependencies.catalog || loadCatalog(sourceRoot);
  const commit = dependencies.commit === undefined ? readGitCommit(sourceRoot) : dependencies.commit;
  const adapter = dependencies.adapter || createEccAdapter({ sourceRoot, commit });
  const incetroVersion = dependencies.incetroVersion || readIncetroVersion(sourceRoot);
  const state = readState(projectRoot);
  const homeDir = dependencies.homeDir || os.homedir();

  return {
    sourceRoot,
    cwd,
    projectRoot,
    projectName: projectName(projectRoot),
    config,
    target,
    catalog,
    adapter,
    commit,
    incetroVersion,
    state,
    homeDir,
    gitAvailable: gitAvailable(),
    nodeVersion: process.versions.node,
  };
}

function resolveProjectSelection(context, options = {}) {
  const detection = (!options.profile && !context.config.profile && context.config.autoDetectProfile !== false)
    ? detectProfile(context.projectRoot)
    : null;
  const profileId = options.profile || context.config.profile || (detection ? detection.profile : DEFAULT_PROFILE);
  const selection = resolveSelection({
    sourceRoot: context.sourceRoot,
    profileId,
    catalog: context.catalog,
    config: context.config,
    adapter: context.adapter,
    target: context.target.id,
  });
  const desired = buildDesired(
    context.sourceRoot,
    context.projectRoot,
    selection,
    context.target,
    context.catalog
  );
  const eccPaths = context.adapter.listManagedPaths({
    projectRoot: context.projectRoot,
    target: context.target.id,
    homeDir: context.homeDir,
  });
  const entries = classify({
    projectRoot: context.projectRoot,
    desired,
    stateFiles: context.state ? context.state.files : [],
    eccPaths,
  });
  return {
    detection,
    profileId,
    selection,
    desired,
    entries,
  };
}

function requireState(context) {
  if (!context.state) {
    throw new IncetroError(
      'Incetro ECC is not initialized in this project.\n\nUse:\nincetro-ecc init',
      EXIT.UNHEALTHY
    );
  }
  return context.state;
}

module.exports = {
  createContext,
  requireState,
  resolveProjectSelection,
};
