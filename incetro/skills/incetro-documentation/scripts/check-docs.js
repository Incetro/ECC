#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DIVIDER = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const SHIELDS = /https?:\/\/img\.shields\.io\/[^\s)>"']+/g;
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

function checkProject(root) {
  const directory = path.resolve(root);
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error('Нет директории проекта: ' + directory);
  }
  const files = collectDocs(directory);
  const issues = files.flatMap(file => checkFile(file, directory));
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

module.exports = { collectDocs, checkFile, checkProject, main };
