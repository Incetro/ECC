'use strict';

const crypto = require('crypto');
const fs = require('fs');

const { lstatOrNull } = require('./paths');

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  const stat = lstatOrNull(filePath);
  if (!stat || !stat.isFile()) return null;
  return sha256Buffer(fs.readFileSync(filePath));
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

module.exports = {
  sha256Buffer,
  sha256File,
  isSha256,
};
