'use strict';

const fs = require('fs');
const path = require('path');

const {
  EXIT,
  IncetroError,
  MIN_ECC_VERSION,
  compareSemver,
} = require('../constants');
const { sha256File } = require('./hashes');
const { assertContained } = require('./paths');

const CONTRACT = Object.freeze([
  ['request', 'normalizeInstallRequest', 'scripts/lib/install/request.js'],
  ['runtime', 'createInstallPlanFromRequest', 'scripts/lib/install/runtime.js'],
  ['apply', 'applyInstallPlan', 'scripts/lib/install/apply.js'],
  ['lifecycle', 'buildDoctorReport', 'scripts/lib/install-lifecycle.js'],
  ['lifecycle', 'uninstallInstalledStates', 'scripts/lib/install-lifecycle.js'],
  ['lifecycle', 'discoverInstalledStates', 'scripts/lib/install-lifecycle.js'],
  ['manifests', 'loadInstallManifests', 'scripts/lib/install-manifests.js'],
]);

const MODULE_FILES = Object.freeze({
  request: 'scripts/lib/install/request.js',
  runtime: 'scripts/lib/install/runtime.js',
  apply: 'scripts/lib/install/apply.js',
  lifecycle: 'scripts/lib/install-lifecycle.js',
  manifests: 'scripts/lib/install-manifests.js',
});

const DOCTOR_FINGERPRINTS = Object.freeze([
  'drifted-managed-files',
  'missing-managed-files',
]);

function formatCompatibility(result) {
  const lines = ['ECC compatibility check failed.'];
  for (const error of result.errors) {
    lines.push(`Expected: ${error.expected}`);
    lines.push(`Detected: ${error.detected}`);
  }
  return lines.join('\n');
}

function readPackageVersion(sourceRoot) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'));
    return typeof packageJson.version === 'string' ? packageJson.version : null;
  } catch (_error) {
    return null;
  }
}

function loadModules(sourceRoot) {
  const modules = {};
  const errors = [];
  for (const [key, relativePath] of Object.entries(MODULE_FILES)) {
    const absolute = path.join(sourceRoot, relativePath);
    if (!fs.existsSync(absolute)) {
      errors.push({ expected: relativePath, detected: 'file missing' });
      continue;
    }
    try {
      modules[key] = require(absolute);
    } catch (error) {
      errors.push({ expected: relativePath, detected: `failed to load (${error.message})` });
    }
  }
  for (const [key, exportName, relativePath] of CONTRACT) {
    if (!modules[key] || typeof modules[key][exportName] !== 'function') {
      errors.push({
        expected: `${relativePath} export ${exportName}`,
        detected: 'missing export',
      });
    }
  }
  const lifecyclePath = path.join(sourceRoot, MODULE_FILES.lifecycle);
  if (fs.existsSync(lifecyclePath)) {
    const source = fs.readFileSync(lifecyclePath, 'utf8');
    for (const fingerprint of DOCTOR_FINGERPRINTS) {
      if (!source.includes(fingerprint)) {
        errors.push({
          expected: `doctor issue code ${fingerprint}`,
          detected: 'code not found in install-lifecycle.js',
        });
      }
    }
  }
  const version = readPackageVersion(sourceRoot);
  if (!version) {
    errors.push({ expected: `ECC version >= ${MIN_ECC_VERSION}`, detected: 'package.json version missing' });
  } else if (compareSemver(version, MIN_ECC_VERSION) < 0) {
    errors.push({ expected: `ECC version >= ${MIN_ECC_VERSION}`, detected: version });
  }
  return {
    ok: errors.length === 0,
    errors,
    modules,
    version,
  };
}

function issuePaths(issue) {
  if (Array.isArray(issue.paths)) return issue.paths.map(value => String(value));
  if (Array.isArray(issue.extra && issue.extra.paths)) return issue.extra.paths.map(value => String(value));
  return [];
}

function mapDoctor(report) {
  const results = Array.isArray(report && report.results) ? report.results : [];
  const issues = [];
  for (const result of results) {
    for (const issue of result.issues || []) {
      issues.push({
        severity: issue.severity || 'error',
        code: issue.code || 'ecc-doctor',
        message: issue.message || 'ECC doctor reported an issue',
        paths: issuePaths(issue),
      });
    }
  }
  const driftedPaths = issues
    .filter(issue => issue.code === 'drifted-managed-files')
    .flatMap(issue => issue.paths);
  const missingPaths = issues
    .filter(issue => issue.code === 'missing-managed-files')
    .flatMap(issue => issue.paths);
  const errorCount = issues.filter(issue => issue.severity === 'error').length;
  let status = 'absent';
  if (results.length > 0) {
    status = errorCount > 0 ? 'error' : (issues.length > 0 ? 'warning' : 'ok');
  }
  return {
    ok: errorCount === 0,
    status,
    issues,
    driftedPaths,
    missingPaths,
    checkedCount: results.length,
  };
}

function planDestinations(plan) {
  return (Array.isArray(plan.operations) ? plan.operations : [])
    .map(operation => operation.destinationPath)
    .filter(destination => typeof destination === 'string' && destination.length > 0);
}

function assertPlanInside(plan, projectRoot) {
  if (!plan || !Array.isArray(plan.operations)) {
    throw new IncetroError(
      'ECC compatibility check failed.\nExpected: install plan.operations array\nDetected: missing plan operations',
      EXIT.FAILURE
    );
  }
  for (const destination of [...planDestinations(plan), plan.installStatePath]) {
    if (typeof destination !== 'string' || destination.length === 0) continue;
    assertContained(projectRoot, destination);
  }
}

function countChanges(destinations, before) {
  let changed = 0;
  for (const destination of destinations) {
    const next = sha256File(destination);
    if (next !== before.get(destination)) changed += 1;
  }
  return changed;
}

function createEccAdapter(options = {}) {
  const sourceRoot = options.sourceRoot;
  let loaded = null;

  function compatibility() {
    if (!loaded) loaded = loadModules(sourceRoot);
    return {
      ok: loaded.ok,
      errors: loaded.errors,
      version: loaded.version,
      expected: CONTRACT.map(([, exportName, relativePath]) => `${relativePath}#${exportName}`),
      detected: loaded.ok ? [`ecc ${loaded.version}`] : loaded.errors.map(error => error.detected),
    };
  }

  function modules() {
    const result = compatibility();
    if (!result.ok) {
      throw new IncetroError(formatCompatibility(result), EXIT.FAILURE, result);
    }
    return loaded.modules;
  }

  function installRequest(input) {
    const skillIds = (input.skillIds || []).map(id => (id.startsWith('skill:') ? id : `skill:${id}`));
    return modules().request.normalizeInstallRequest({
      target: input.target,
      profileId: input.profileId,
      moduleIds: input.moduleIds || [],
      includeComponentIds: skillIds,
      noHooks: input.hooks !== true,
      enableHooks: input.hooks === true,
    });
  }

  function createPlan(input) {
    const request = installRequest(input);
    const plan = modules().runtime.createInstallPlanFromRequest(request, {
      projectRoot: input.projectRoot,
      sourceRoot,
      homeDir: input.homeDir,
    });
    assertPlanInside(plan, input.projectRoot);
    return plan;
  }

  return {
    checkCompatibility: compatibility,
    formatCompatibility,
    versions() {
      return {
        version: compatibility().ok ? loaded.version : readPackageVersion(sourceRoot),
        commit: options.commit || null,
      };
    },
    assertSelection(input) {
      const manifests = modules().manifests.loadInstallManifests({ repoRoot: sourceRoot });
      const supported = modules().manifests.SUPPORTED_INSTALL_TARGETS || [];
      if (!supported.includes(input.target)) {
        throw new IncetroError(
          `ECC compatibility check failed.\nExpected: install target ${input.target}\nDetected: ${supported.join(', ') || '(none)'}`,
          EXIT.FAILURE
        );
      }
      if (input.profileId && !manifests.profiles[input.profileId]) {
        throw new IncetroError(`Unknown ECC profile: ${input.profileId}`, EXIT.CONFIG);
      }
      for (const skillId of input.skillIds || []) {
        if (!manifests.componentsById.has(`skill:${skillId}`)) {
          throw new IncetroError(`Unknown ECC skill: ${skillId}`, EXIT.CONFIG);
        }
      }
      if ((input.moduleIds || []).length > 0) {
        modules().manifests.validateInstallModuleIds(input.moduleIds, { repoRoot: sourceRoot });
      }
    },
    install(input) {
      const plan = createPlan(input);
      const destinations = planDestinations(plan);
      if (input.dryRun) {
        return {
          ok: true,
          dryRun: true,
          applied: false,
          operationCount: destinations.length,
          changed: 0,
          warnings: Array.isArray(plan.warnings) ? plan.warnings : [],
          skipped: 0,
          installStatePath: plan.installStatePath || null,
        };
      }
      const before = new Map(destinations.map(destination => [destination, sha256File(destination)]));
      let applied;
      try {
        applied = modules().apply.applyInstallPlan(plan);
      } catch (error) {
        throw new IncetroError(`ECC install failed: ${error.message}`, EXIT.FAILURE);
      }
      const appliedDestinations = planDestinations(applied);
      return {
        ok: true,
        dryRun: false,
        applied: true,
        operationCount: appliedDestinations.length,
        changed: countChanges(appliedDestinations, before),
        warnings: Array.isArray(applied.warnings) ? applied.warnings : [],
        skipped: Array.isArray(applied.skippedOperations) ? applied.skippedOperations.length : 0,
        installStatePath: applied.installStatePath || plan.installStatePath || null,
      };
    },
    doctor(input) {
      const report = modules().lifecycle.buildDoctorReport({
        repoRoot: sourceRoot,
        projectRoot: input.projectRoot,
        homeDir: input.homeDir,
        targets: [input.target],
      });
      return mapDoctor(report);
    },
    uninstall(input) {
      const report = modules().lifecycle.uninstallInstalledStates({
        repoRoot: sourceRoot,
        projectRoot: input.projectRoot,
        homeDir: input.homeDir,
        targets: [input.target],
        dryRun: Boolean(input.dryRun),
      });
      const results = Array.isArray(report.results) ? report.results : [];
      const removedCount = results.reduce((sum, result) => (
        sum + (Array.isArray(result.removedPaths) ? result.removedPaths.length : 0)
        + (Array.isArray(result.plannedRemovals) ? result.plannedRemovals.length : 0)
      ), 0);
      const retainedCount = results.reduce((sum, result) => (
        sum + (Array.isArray(result.retainedPaths) ? result.retainedPaths.length : 0)
      ), 0);
      const errors = results.filter(result => result.status === 'error').map(result => result.error).filter(Boolean);
      if (!input.dryRun && errors.length > 0) {
        throw new IncetroError(`ECC uninstall failed: ${errors.join('; ')}`, EXIT.FAILURE);
      }
      return {
        ok: errors.length === 0,
        dryRun: Boolean(input.dryRun),
        removedCount,
        retainedCount,
        warnings: results.map(result => result.warning).filter(Boolean),
        results,
      };
    },
    listManagedPaths(input) {
      const records = modules().lifecycle.discoverInstalledStates({
        projectRoot: input.projectRoot,
        homeDir: input.homeDir,
        targets: [input.target],
      });
      const paths = [];
      for (const record of records) {
        const operations = record && record.state && Array.isArray(record.state.operations)
          ? record.state.operations
          : [];
        for (const operation of operations) {
          if (operation && operation.ownership === 'managed' && typeof operation.destinationPath === 'string') {
            paths.push(path.resolve(operation.destinationPath));
          }
        }
      }
      return paths;
    },
  };
}

module.exports = {
  CONTRACT,
  DOCTOR_FINGERPRINTS,
  createEccAdapter,
  formatCompatibility,
  loadModules,
};
