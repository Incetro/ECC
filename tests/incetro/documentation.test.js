'use strict';

const assert = require('assert');
const path = require('path');
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
    '![Python](https://img.shields.io/badge/Python-3.12-7C3AED?style=flat-square)',
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
    '![Python](https://img.shields.io/badge/Python-3.12-7C3AED?style=for-the-badge)',
  ].join('\n'));
  const issues = checkProject(root).issues;
  assert.ok(issues.some(issue => issue.message.includes('длинное тире')));
  assert.ok(issues.some(issue => issue.message.includes('разделитель Markdown')));
  assert.ok(issues.some(issue => issue.message.includes('HTML-разделитель')));
  assert.ok(issues.some(issue => issue.message.includes('отсутствующий путь')));
  assert.ok(issues.some(issue => issue.message.includes('flat-square')));
});

harness.test('does not touch project files', () => {
  const root = makeTempDir('docs-readonly');
  const file = writeFile(root, 'README.md', '# Project\n');
  const before = fs.readFileSync(file, 'utf8');
  checkProject(root);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
});

harness.finish();
