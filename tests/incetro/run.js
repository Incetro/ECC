#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = __dirname;
const e2e = process.argv.includes('--e2e');
const files = fs.readdirSync(testsDir)
  .filter(name => name.endsWith('.test.js'))
  .sort();

let failed = 0;
for (const file of files) {
  const env = { ...process.env };
  if (e2e) env.INCETRO_E2E = '1';
  const result = spawnSync(process.execPath, [path.join(testsDir, file)], {
    encoding: 'utf8',
    env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    failed += 1;
    console.log(`FAIL ${file}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
