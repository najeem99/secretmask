import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import type { Masker } from './masker';
import type { Vault } from './types';

export const DEFAULT_EXTENSIONS = [
  '.yml', '.yaml', '.properties', '.env', '.java', '.kt', '.xml', '.json', '.js', '.ts',
  '.py', '.go', '.cs', '.rb', '.php', '.sql', '.toml', '.ini', '.conf', '.cfg', '.tf',
];
export const DEFAULT_SKIP_DIRS = [
  '.git', 'node_modules', 'target', 'build', 'dist', 'out', '.idea', '.vscode', '.gradle', 'venv', '.venv',
];
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface WorkspaceOptions {
  extensions?: string[];
  skipDirs?: string[];
}

export type Mode = 'mask' | 'unmask';

/** Applies a Masker to every candidate file in a project folder. */
export class Workspace {
  private readonly exts: Set<string>;
  private readonly skip: Set<string>;

  constructor(
    readonly root: string,
    private readonly masker: Masker,
    private readonly vault: Vault,
    opts: WorkspaceOptions = {},
  ) {
    this.exts = new Set(opts.extensions ?? DEFAULT_EXTENSIONS);
    this.skip = new Set(opts.skipDirs ?? DEFAULT_SKIP_DIRS);
  }

  isMasked(): boolean {
    return this.vault.isMasked(this.root);
  }

  /** Returns the files that changed. Safe to run repeatedly. */
  run(mode: Mode): string[] {
    const changed: string[] = [];
    for (const file of this.files(this.root)) {
      const src = readFileSync(file, 'utf8');
      if (src.includes('\u0000')) continue; // binary
      const out = mode === 'mask' ? this.masker.mask(src) : this.masker.unmask(src);
      if (out !== src) {
        writeFileSync(file, out);
        changed.push(file);
      }
    }
    this.vault.setMasked(this.root, mode === 'mask');
    this.vault.flush();
    this.refreshGitIndex(changed);
    return changed;
  }

  private *files(dir: string): Generator<string> {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (!this.skip.has(e.name)) yield* this.files(p);
      } else if (e.isFile() && (this.exts.has(extname(e.name).toLowerCase()) || e.name.startsWith('.env'))) {
        try {
          if (statSync(p).size <= MAX_FILE_BYTES) yield p;
        } catch {
          /* vanished */
        }
      }
    }
  }

  /**
   * Masking changes file sizes, so `git status` flags files without running the
   * clean filter. For each file whose filtered content still equals the staged
   * blob, re-add it: nothing new is staged, git just refreshes its stat cache.
   */
  private refreshGitIndex(files: string[]) {
    if (!files.length || !existsSync(join(this.root, '.git'))) return;
    const git = (args: string[]) =>
      execFileSync('git', args, { cwd: this.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    for (const f of files) {
      try {
        const rel = relative(this.root, f).split(sep).join('/');
        const staged = git(['ls-files', '-s', '--', rel]).split(/\s+/)[1];
        if (staged && git(['hash-object', `--path=${rel}`, '--', rel]) === staged) git(['add', '--', rel]);
      } catch {
        /* not tracked / git missing: ignore */
      }
    }
  }
}
