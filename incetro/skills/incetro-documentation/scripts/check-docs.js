#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DIVIDER = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const SHIELDS = /https?:\/\/img\.shields\.io\/[^\s)>"']+/g;
const LABEL_COLOR = 'F5F7FB';
const LOGO_COLOR = '334155';
const PALETTE = new Set(['448FC7', '9170CF', '34A494', '7587CF', '778EA5', '42A87A', '8F9FB0', 'DCA052', 'D56C7D']);
const MARKDOWN_LINK = /!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']+["'])?\)/g;
const IGNORE = new Set(['.git', '.cursor', '.incetro-ecc', 'node_modules', 'vendor', 'build', 'dist', '.venv', '__pycache__']);

function collectDocs(root) {
  const found = [];
  for (const file of fs.readdirSync(root, { withFileTypes: true })) {
    if (file.isFile() && /^readme(?:[._-].+)?\.md$/i.test(file.name)) found.push(path.join(root, file.name));
  }
  const docs = path.join(root, 'docs');
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || IGNORE.has(entry.name)) continue;
      const current = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(current);
      else if (entry.isFile() && /\.md$/i.test(entry.name)) found.push(current);
    }
  }
  walk(docs);
  return found.sort();
}

function checkFile(file, root) {
  const issues = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let fence = null;
  let frontmatter = false;
  let frontmatterClosed = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const number = i + 1;
    if (i === 0 && line === '---') { frontmatter = true; continue; }
    if (frontmatter) {
      if (line === '---') { frontmatter = false; frontmatterClosed = true; }
      continue;
    }
    const matched = line.match(FENCE);
    if (matched) {
      const marker = matched[1];
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    // Ignore inline code while checking prose typography and dividers.
    const prose = line.replace(/`+[^`\n]*`+/g, '');
    if (DIVIDER.test(line)) {
      issues.push({ file, line: number, message: 'Декоративный разделитель Markdown запрещён.' });
    }
    if (/\u2014/.test(prose)) {
      issues.push({ file, line: number, message: 'Использовано длинное тире —; в прозе требуется –.' });
    }
    if (/<hr(?:\s[^>]*)?\s*\/?\s*>/i.test(prose)) {
      issues.push({ file, line: number, message: 'Декоративный HTML-разделитель запрещён.' });
    }
    for (const badge of line.matchAll(SHIELDS)) {
      const url = badge[0].replaceAll('&amp;', '&');
      if (!/[?&]style=flat-square(?:&|$)/.test(url)) {
        issues.push({ file, line: number, message: 'Shields.io badge должен иметь style=flat-square.' });
      }
      // Static badges must use a color from the centrally defined Incetro palette.
      const parsed = new URL(url);
      const normalizeHex = value => (value || '').replace(/^%23|^#/, '').toUpperCase();
      if (normalizeHex(parsed.searchParams.get('labelColor')) !== LABEL_COLOR) {
        issues.push({ file, line: number, message: 'Для единого стиля требуется labelColor=' + LABEL_COLOR });
      }
      if (parsed.searchParams.has('logo') && normalizeHex(parsed.searchParams.get('logoColor')) !== LOGO_COLOR) {
        issues.push({ file, line: number, message: 'Для логотипа требуется logoColor=' + LOGO_COLOR });
      }
      let color = null;
      if (parsed.pathname.startsWith('/badge/')) {
        color = parsed.pathname.split('-').pop();
      } else if (parsed.pathname === '/static/v1') {
        color = parsed.searchParams.get('color');
      }
      if (color && !PALETTE.has(color.replace(/^%23|^#/, '').toUpperCase())) {
        issues.push({ file, line: number, message: 'Цвет бейджа вне палитры Incetro: ' + color });
      }
    }
    for (const match of line.matchAll(MARKDOWN_LINK)) {
      let target = (match[1] || match[2]).trim();
      if (!target || /^(?:https?:|mailto:|tel:|data:|#)/i.test(target)) continue;
      target = target.split('#')[0].split('?')[0];
      if (!target) continue;
      try { target = decodeURIComponent(target); }
      catch (_) { issues.push({ file, line: number, message: 'Некорректная кодировка относительной ссылки.' }); continue; }
      const resolved = target.startsWith('/')
        ? path.resolve(root, '.' + target)
        : path.resolve(path.dirname(file), target);
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        issues.push({ file, line: number, message: 'Относительная ссылка выходит за пределы проекта.' });
      } else if (!fs.existsSync(resolved)) {
        issues.push({ file, line: number, message: 'Ссылка ведёт на отсутствующий путь: ' + target });
      }
    }
  }
  if (frontmatter && !frontmatterClosed) {
    issues.push({ file, line: 1, message: 'Незакрытый YAML frontmatter.' });
  }
  return issues;
}


function detectTechnologySignals(root) {
  const technologies = new Set();
  const has = name => {
    const file = path.join(root, name);
    return fs.existsSync(file) && fs.statSync(file).isFile();
  };
  const read = name => {
    if (!has(name)) return '';
    const file = path.join(root, name);
    if (fs.statSync(file).size > 1024 * 1024) return '';
    return fs.readFileSync(file, 'utf8');
  };
  if (['pyproject.toml', 'requirements.txt', 'Pipfile', 'setup.py'].some(has)) technologies.add('Python');
  if (has('package.json')) technologies.add('Node.js');
  if (has('go.mod')) technologies.add('Go');
  if (has('Cargo.toml')) technologies.add('Rust');
  if (has('Package.swift')) technologies.add('Swift');
  if (has('pubspec.yaml')) technologies.add(/(^|\n)\s*flutter\s*:/m.test(read('pubspec.yaml')) ? 'Flutter' : 'Dart');
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  if (has('Dockerfile') || composeFiles.some(has)) technologies.add('Docker');
  const compose = composeFiles.map(read).join('\n');
  if (/^\s*image:\s*["']?(?:[\w.-]+\/)*postgres(?::|@|\b)/im.test(compose)) technologies.add('PostgreSQL');
  if (/^\s*image:\s*["']?(?:[\w.-]+\/)*redis(?::|@|\b)/im.test(compose)) technologies.add('Redis');
  if (/^\s*image:\s*["']?(?:[\w.-]+\/)*mysql(?::|@|\b)/im.test(compose)) technologies.add('MySQL');
  return technologies;
}

function checkReadmeBadges(root) {
  const readme = path.join(root, 'README.md');
  if (!fs.existsSync(readme) || !fs.statSync(readme).isFile()) return [];
  const expected = Math.min(3, detectTechnologySignals(root).size);
  if (expected === 0) return [];
  const firstSection = fs.readFileSync(readme, 'utf8').split(/^##\s+/m, 1)[0];
  const actual = [...firstSection.matchAll(SHIELDS)].length;
  if (actual >= expected) return [];
  return [{
    file: readme,
    line: 1,
    message: 'README программного проекта: требуется минимум ' + expected
      + (expected === 1 ? ' бейдж Shields.io' : ' бейджа Shields.io') + ' в первом разделе; найдено ' + actual
      + '. Неподтверждённые технологии ради количества не добавлять.',
  }];
}

function checkProject(root) {
  const directory = path.resolve(root);
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error('Нет директории проекта: ' + directory);
  }
  const files = collectDocs(directory);
  const issues = files.flatMap(file => checkFile(file, directory)).concat(checkReadmeBadges(directory));
  return { root: directory, files, issues };
}

function main(argv) {
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex < 0 ? process.cwd() : argv[rootIndex + 1];
  if (argv.includes('--help')) {
    process.stdout.write('Usage: node check-docs.js [--root PATH]\n');
    return 0;
  }
  if (!root) {
    process.stderr.write('Missing --root argument.\n');
    return 2;
  }
  const result = checkProject(root);
  for (const issue of result.issues) {
    const relative = path.relative(result.root, issue.file).replaceAll(path.sep, '/');
    process.stderr.write(relative + ':' + issue.line + ': ' + issue.message + '\n');
  }
  process.stdout.write('Docs checked: ' + result.files.length + '; issues: ' + result.issues.length + '\n');
  return result.issues.length ? 1 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 2; }
}

module.exports = { collectDocs, checkFile, checkProject, checkReadmeBadges, detectTechnologySignals, main };
