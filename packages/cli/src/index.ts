#!/usr/bin/env node
/**
 * secretmask CLI: used directly, by Claude Code hooks and by the git clean filter.
 *   secretmask mask   [dir]
 *   secretmask unmask [dir]
 *   secretmask status [dir]
 *   secretmask clean            git filter: stdin -> stdout with real values restored
 */
import { createMasker, createWorkspace } from '@secretmask/core';

const USAGE = 'usage: secretmask <mask|unmask|status|clean> [dir]';

function readStdin(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (c: Buffer) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)));
    process.stdin.on('error', reject);
  });
}

async function main(argv: string[]): Promise<number> {
  const [cmd, dirArg] = argv;
  const dir = dirArg ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

  switch (cmd) {
    case 'mask':
    case 'unmask': {
      const changed = createWorkspace(dir).run(cmd);
      process.stderr.write(`secretmask: ${cmd}ed ${changed.length} file(s)\n`);
      return 0;
    }
    case 'status':
      console.log(createWorkspace(dir).isMasked() ? 'masked' : 'unmasked');
      return 0;
    case 'clean': {
      const buf = await readStdin();
      process.stdout.write(buf.includes(0) ? buf : createMasker().unmask(buf.toString('utf8')));
      return 0;
    }
    default:
      console.error(USAGE);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: Error) => {
    // Never block Claude Code or git because of us.
    process.stderr.write(`secretmask error: ${err.message}\n`);
    process.exit(0);
  },
);
