#!/usr/bin/env node
'use strict';

const { main } = require('./incetro/cli');

process.exit(main(process.argv.slice(2)));
