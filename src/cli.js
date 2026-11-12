#!/usr/bin/env node
'use strict';
// CLI used by Claude Code hooks and the git clean filter.
//   node cli.js mask   [dir]   - replace secrets with SECRET_xxxx tokens
//   node cli.js unmask [dir]   - restore real values
//   node cli.js status [dir]
//   node cli.js clean          - git filter: stdin -> stdout with tokens restored
const core = require('./core');

const [cmd, dirArg] = process.argv.slice(2);
const dir = dirArg || process.env.CLAUDE_PROJECT_DIR || process.cwd();

try {
  switch (cmd) {
    case 'mask':
    case 'unmask': {
      const files = core.processDir(dir, cmd);
      process.stderr.write(`secretmask: ${cmd}ed ${files.length} file(s)\n`);
      break;
    }
    case 'status':
      console.log(core.isMasked(dir) ? 'masked' : 'unmasked');
      break;
    case 'clean': {
      const chunks = [];
      process.stdin.on('data', (c) => chunks.push(c));
      process.stdin.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.includes(0)) { process.stdout.write(buf); return; }
        process.stdout.write(core.unmaskText(core.loadVault(), buf.toString('utf8')));
      });
      break;
    }
    default:
      console.error('usage: secretmask <mask|unmask|status|clean> [dir]');
      process.exit(2);
  }
} catch (e) {
  // Never block Claude or git because of us
  process.stderr.write('secretmask error: ' + e.message + '\n');
  process.exit(0);
}
