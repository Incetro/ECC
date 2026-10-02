'use strict';

const { readIncetroVersion } = require('../constants');

const COMMANDS = Object.freeze([
  ['init [path]', 'Install ECC and the Incetro overlay'],
  ['update [path]', 'Refresh ECC and Incetro files'],
  ['status [path]', 'Show profile, versions, and health'],
  ['doctor [path]', 'Check Node, Git, state, drift, and conflicts'],
  ['diff [path]', 'Compare installed files with the overlay'],
  ['remove [path]', 'Remove Incetro-owned files'],
  ['self-update', 'Update this command'],
  ['version', 'Print Incetro and ECC versions'],
  ['help', 'Show this help'],
]);

const OPTIONS = Object.freeze([
  ['--profile <id>', 'Profile for init'],
  ['--keep-local', 'Leave drifted files in place'],
  ['--accept-incetro', 'Replace drifted files with the overlay'],
  ['--dry-run', 'Show the remove plan'],
  ['--yes', 'Apply remove'],
  ['--json', 'Print one JSON object'],
  ['--verbose, -v', 'Include paths and warnings'],
  ['--help, -h', 'Show this help'],
]);

const EXAMPLES = Object.freeze([
  'incetro-ecc init [path] [--profile <id>]',
  'incetro-ecc update [path] [--keep-local | --accept-incetro]',
  'incetro-ecc remove [path] [--dry-run | --yes]',
]);

const EXITS = Object.freeze([
  ['0', 'success'],
  ['1', 'generic failure'],
  ['2', 'invalid configuration'],
  ['3', 'conflicts detected'],
  ['4', 'drift detected'],
  ['5', 'unhealthy installation'],
]);

/**
 * @param {boolean} enabled
 * @param {string} text
 * @param {string} code
 * @returns {string}
 */
function span(enabled, text, code) {
  if (!enabled || !code) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

/**
 * @param {ReadonlyArray<readonly [string, string]>} rows
 * @returns {number}
 */
function columnWidth(rows) {
  return rows.reduce((width, [label]) => Math.max(width, label.length), 0);
}

/**
 * @param {boolean} color
 * @param {ReadonlyArray<readonly [string, string]>} rows
 * @param {'command' | 'option' | 'exit'} kind
 * @returns {string[]}
 */
function rows(color, items, kind) {
  const width = columnWidth(items);
  const gutter = kind === 'exit' ? 2 : 4;
  return items.map(([label, detail]) => {
    const painted = kind === 'exit'
      ? span(color, label, label === '0' ? '32' : '33')
      : span(color, label, kind === 'command' ? '36' : '1');
    const gap = ' '.repeat(width - label.length + gutter);
    return `    ${painted}${gap}${detail}`;
  });
}

function blockWidth(version) {
  const gutter = 4;
  const measure = (items, labelWidth) => 4 + labelWidth + gutter
    + items.reduce((max, [, detail]) => Math.max(max, detail.length), 0);
  return Math.max(
    `  incetro-ecc  ${version}`.length,
    measure(COMMANDS, columnWidth(COMMANDS)),
    measure(OPTIONS, columnWidth(OPTIONS)),
    ...EXAMPLES.map(example => example.length + 4),
  );
}

/**
 * Plain help by default. Pass `{ color: true }` for terminal styling.
 * @param {{ color?: boolean, version?: string }} [options]
 * @returns {string}
 */
function formatHelp(options = {}) {
  const color = options.color === true;
  const version = options.version || readIncetroVersion();
  const rule = span(color, '─'.repeat(Math.max(24, blockWidth(version) - 2)), '36');
  const lines = [
    `  ${span(color, 'incetro-ecc', '1;36')}  ${span(color, version, '36')}`,
    '  Cursor Dev OS on top of ECC.',
    '',
    `  ${rule}`,
    '',
    `  ${span(color, 'Usage', '1')}`,
    `    ${span(color, 'incetro-ecc <command> [path] [options]', '36')}`,
    '',
    `  ${span(color, 'Commands', '1')}`,
    ...rows(color, COMMANDS, 'command'),
    '',
    `  ${span(color, 'Options', '1')}`,
    ...rows(color, OPTIONS, 'option'),
    '',
    `  ${span(color, 'Examples', '1')}`,
    ...EXAMPLES.map(example => `    ${span(color, example, '36')}`),
    '',
    `  ${span(color, 'Exit codes:', '1')}`,
    ...rows(color, EXITS, 'exit'),
  ];
  return lines.join('\n');
}

/**
 * @param {NodeJS.WriteStream} [stream]
 * @returns {boolean}
 */
function shouldColor(stream = process.stdout) {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === '0') return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(stream && stream.isTTY);
}

module.exports = {
  formatHelp,
  shouldColor,
};
