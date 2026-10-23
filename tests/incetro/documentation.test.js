'use strict';

const assert = require('assert');
const fs = require('fs');
const { loadCatalog } = require('../../scripts/incetro/core/manifest');
const { resolveSelection } = require('../../scripts/incetro/core/profiles');
const { checkProject } = require('../../incetro/skills/incetro-documentation/scripts/check-docs');
const { createHarness, fakeAdapter, makeTempDir, repoRoot, skipIfOldNode, writeFile } = require('./helpers');

skipIfOldNode();
const harness = createHarness();

harness.test('core profile contains documentation rule, skill and reviewer', () => {
  const catalog = loadCatalog(repoRoot);
  const selected = resolveSelection({
    sourceRoot: repoRoot,
    profileId: 'core',
    catalog,
    config: { include: [], exclude: [] },
    adapter: fakeAdapter(),
    target: 'cursor',
  });
  assert.ok(selected.incetro.rules.includes('incetro-documentation'));
  assert.ok(selected.incetro.skills.includes('incetro-documentation'));
  assert.ok(selected.incetro.agents.includes('incetro-docs-reviewer'));
});

harness.test('accepts headings, en dashes, frontmatter, fenced code and flat-square', () => {
  const root = makeTempDir('docs-clean');
  writeFile(root, 'README.md', [
    '# Пример',
    '',
    'Telegram-бот – работает 1–3 дня.',
    '',
    '![Python](https://img.shields.io/badge/Python-3.12-9170CF?style=flat-square&labelColor=F5F7FB&logo=python&logoColor=334155)',
    '',
    '[Архитектура](docs/architecture.md)',
    '',
    '```md',
    '---',
    '—',
    '```',
  ].join('\n'));
  writeFile(root, 'docs/architecture.md', '---\ntitle: Архитектура\n---\n# Архитектура\n');
  assert.deepStrictEqual(checkProject(root).issues, []);
});

harness.test('rejects dividers, em dash, broken links, incorrect badges', () => {
  const root = makeTempDir('docs-invalid');
  writeFile(root, 'README.md', [
    '# Пример',
    'Описание — с ошибкой.',
    '---',
    '<hr>',
    '[Не найдено](docs/missing.md)',
    '![Python](https://img.shields.io/badge/Python-3.12-9170CF?style=for-the-badge)',
    '![Ruby](https://img.shields.io/badge/Ruby-3.1-FF00FF?style=flat-square)',
  ].join('\n'));
  const issues = checkProject(root).issues;
  assert.ok(issues.some(issue => issue.message.includes('длинное тире')));
  assert.ok(issues.some(issue => issue.message.includes('разделитель Markdown')));
  assert.ok(issues.some(issue => issue.message.includes('HTML-разделитель')));
  assert.ok(issues.some(issue => issue.message.includes('отсутствующий путь')));
  assert.ok(issues.some(issue => issue.message.includes('flat-square')));
  assert.ok(issues.some(issue => issue.message.includes('вне палитры')));
  assert.ok(issues.some(issue => issue.message.includes('labelColor')));
});


harness.test('requires 3 badges when Python, Docker and PostgreSQL are verified', () => {
  const root = makeTempDir('docs-badge-required');
  writeFile(root, 'pyproject.toml', '[project]\nrequires-python = ">=3.12"\n');
  writeFile(root, 'Dockerfile', 'FROM python:3.12-slim\n');
  writeFile(root, 'docker-compose.yml', 'services:\n  db:\n    image: postgres:16-alpine\n');
  const readme = writeFile(root, 'README.md', '# Пример\n\nПроект с проверенным стеком.\n');
  assert.ok(checkProject(root).issues.some(issue => issue.message.includes('минимум 3 бейджа')));
  const badge = (name, color) =>
    '![' + name + '](https://img.shields.io/badge/' + name + '-verified-' + color
    + '?style=flat-square&labelColor=F5F7FB)';
  fs.writeFileSync(readme, '# Пример\n\n'
    + badge('Python', '9170CF') + '\n'
    + badge('PostgreSQL', '7587CF') + '\n'
    + badge('Docker', '778EA5') + '\n\n## О проекте\n');
  assert.deepStrictEqual(checkProject(root).issues, []);
});

harness.test('does not force badges into a docs-only repository', () => {
  const root = makeTempDir('docs-no-stack');
  writeFile(root, 'README.md', '# Описание\n\nТекст документации.\n');
  assert.deepStrictEqual(checkProject(root).issues, []);
});

harness.test('requires only verified amount when stack has a single signal', () => {
  const root = makeTempDir('docs-python-only');
  writeFile(root, 'pyproject.toml', '[project]\nname = "demo"\n');
  writeFile(root, 'README.md', '# Пример\n');
  assert.ok(checkProject(root).issues.some(issue => issue.message.includes('минимум 1 бейдж')));
});

harness.test('does not touch project files', () => {
  const root = makeTempDir('docs-readonly');
  const file = writeFile(root, 'README.md', '# Project\n');
  const before = fs.readFileSync(file, 'utf8');
  checkProject(root);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
});

harness.finish();
