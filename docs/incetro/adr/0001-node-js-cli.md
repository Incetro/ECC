# ADR 0001: Node.js CLI

## Status

Accepted

## Decision

The Incetro interface is a Node.js 20+ CommonJS CLI, `incetro-ecc`, launched from `package.json` `bin`. It uses `node:test`-compatible assertions through the existing ECC test runner, plus `fs` and `path`.

## Consequences

Users install with npm. The CLI runs on Windows, macOS, and Linux without a shell script. Python, TypeScript builds, and a database are not part of this layer.
