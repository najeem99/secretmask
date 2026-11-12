import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_EXTENSIONS } from '@secretmask/core';

const TAG = 'secretmask';

/** Shell command that runs the bundled CLI. Quoted for POSIX shells and Windows cmd. */
export function cliCommand(cliPath: string, args: string): string {
  return `node "${cliPath}" ${args}`;
}

type HookEntry = { matcher?: string; hooks: { type: 'command'; command: string }[] };

/** Installs mask/unmask hooks in .claude/settings.local.json (never committed). */
export function installClaudeHooks(root: string, cliPath: string): string {
  const file = join(root, '.claude', 'settings.local.json');
  let settings: { hooks?: Record<string, HookEntry[]> } = {};
  if (existsSync(file)) {
    try {
      settings = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      throw new Error(`${file} is not valid JSON; fix it and try again`);
    }
  }
  const hooks = (settings.hooks ??= {});
  const add = (event: string, args: string, matcher?: string) => {
    const others = (hooks[event] ?? []).filter((h) => !JSON.stringify(h).includes(TAG));
    const entry: HookEntry = { hooks: [{ type: 'command', command: `${cliCommand(cliPath, args)} # ${TAG}` }] };
    if (matcher) entry.matcher = matcher;
    hooks[event] = [...others, entry];
  };
  // `mask` is idempotent and also picks up tokens left behind by a crashed session.
  add('SessionStart', 'mask');
  add('PostToolUse', 'mask', 'Write|Edit|MultiEdit');
  add('SessionEnd', 'unmask');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return file;
}

/** Installs the git clean filter in .git/config and .git/info/attributes (never committed). */
export function installGitFilter(root: string, cliPath: string): void {
  if (!existsSync(join(root, '.git'))) throw new Error('No git repository in this folder');
  const git = (args: string[]) => execFileSync('git', args, { cwd: root });
  git(['config', 'filter.secretmask.clean', cliCommand(cliPath, 'clean')]);
  git(['config', 'filter.secretmask.smudge', 'cat']);

  const attr = join(root, '.git', 'info', 'attributes');
  mkdirSync(dirname(attr), { recursive: true });
  const current = existsSync(attr) ? readFileSync(attr, 'utf8') : '';
  if (current.includes('filter=secretmask')) return;
  const lines = [...DEFAULT_EXTENSIONS.map((e) => `*${e} filter=secretmask`), '.env* filter=secretmask'];
  const sep = current && !current.endsWith('\n') ? '\n' : '';
  writeFileSync(attr, `${current}${sep}# ${TAG}\n${lines.join('\n')}\n`);
}
