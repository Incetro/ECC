'use strict';

const { EXIT, IncetroError } = require('./constants');
const { formatHelp, render, renderError } = require('./core/output');
const init = require('./commands/init');
const update = require('./commands/update');
const status = require('./commands/status');
const doctor = require('./commands/doctor');
const diff = require('./commands/diff');
const remove = require('./commands/remove');
const selfUpdate = require('./commands/self-update');
const version = require('./commands/version');

const COMMANDS = new Set([
  'init',
  'update',
  'status',
  'doctor',
  'diff',
  'remove',
  'self-update',
  'version',
  'help',
]);

const PATH_COMMANDS = new Set(['init', 'update', 'status', 'doctor', 'diff', 'remove']);

function parseArgv(argv) {
  const flags = {
    verbose: false,
    json: false,
    help: false,
    profile: null,
    keepLocal: false,
    acceptIncetro: false,
    dryRun: false,
    yes: false,
  };
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--verbose' || arg === '-v') flags.verbose = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--keep-local') flags.keepLocal = true;
    else if (arg === '--accept-incetro') flags.acceptIncetro = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--yes') flags.yes = true;
    else if (arg === '--profile') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new IncetroError('Missing value for --profile', EXIT.CONFIG);
      }
      if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
        throw new IncetroError(`Invalid profile: ${value}`, EXIT.CONFIG);
      }
      flags.profile = value;
      index += 1;
    } else if (arg.startsWith('--')) {
      throw new IncetroError(`Unknown option: ${arg}`, EXIT.CONFIG);
    } else {
      positionals.push(arg);
    }
  }
  if (flags.keepLocal && flags.acceptIncetro) {
    throw new IncetroError('--keep-local and --accept-incetro cannot be combined.', EXIT.CONFIG);
  }
  return { flags, positionals };
}

function dispatch(argv, dependencies = {}) {
  const { flags, positionals } = parseArgv(argv);
  if (flags.help || positionals.length === 0 || positionals[0] === 'help') {
    return {
      exitCode: EXIT.OK,
      result: { type: 'help', ok: true, text: formatHelp() },
    };
  }
  const command = positionals[0];
  if (!COMMANDS.has(command)) {
    throw new IncetroError(`Unknown command: ${command}\n\n${formatHelp()}`, EXIT.FAILURE);
  }
  const pathArg = positionals[1] || null;
  if (pathArg && !PATH_COMMANDS.has(command)) {
    throw new IncetroError(`${command} does not accept a project path.`, EXIT.CONFIG);
  }
  if (positionals.length > (PATH_COMMANDS.has(command) ? 2 : 1)) {
    throw new IncetroError(`Unexpected argument: ${positionals[PATH_COMMANDS.has(command) ? 2 : 1]}`, EXIT.CONFIG);
  }
  const options = {
    ...flags,
    path: pathArg,
    cwd: dependencies.cwd || process.cwd(),
    dependencies,
    verbose: flags.verbose,
    json: flags.json,
  };
  if (command === 'init') return init.run(options);
  if (command === 'update') return update.run(options);
  if (command === 'status') return status.run(options);
  if (command === 'doctor') return doctor.run(options);
  if (command === 'diff') return diff.run(options);
  if (command === 'remove') return remove.run(options);
  if (command === 'self-update') return selfUpdate.run(options);
  if (command === 'version') return version.run(options);
  throw new IncetroError(`Unknown command: ${command}`, EXIT.FAILURE);
}

function main(argv = process.argv.slice(2), dependencies = {}) {
  let json = false;
  let verbose = false;
  try {
    json = argv.includes('--json');
    verbose = argv.includes('--verbose') || argv.includes('-v');
    const outcome = dispatch(argv, dependencies);
    render(outcome.result, { json, verbose });
    return outcome.exitCode;
  } catch (error) {
    const exitCode = error && error.exitCode ? error.exitCode : EXIT.FAILURE;
    renderError(error, { json, verbose });
    return exitCode;
  }
}

module.exports = {
  dispatch,
  main,
  parseArgv,
};
