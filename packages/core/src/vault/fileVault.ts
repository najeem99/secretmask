import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { Vault } from '../types';

interface VaultData {
  version: 1;
  key: string;
  tokens: Record<string, string>;
  masked: Record<string, boolean>;
}

export function defaultVaultPath(): string {
  const home = process.env.SECRETMASK_HOME ?? join(homedir(), '.secretmask');
  return join(home, 'vault.json');
}

/**
 * JSON vault in the user's home directory (mode 600), never inside the project.
 * TODO(v1.0): encrypt at rest with AES-256-GCM, key from the OS keychain.
 */
export class FileVault implements Vault {
  private data: VaultData;

  constructor(private readonly file: string = defaultVaultPath()) {
    this.data = existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as VaultData)
      : { version: 1, key: randomBytes(32).toString('hex'), tokens: {}, masked: {} };
    if (!existsSync(file)) this.flush();
  }

  get key(): string {
    return this.data.key;
  }
  get(token: string) {
    return this.data.tokens[token];
  }
  put(token: string, secret: string) {
    this.data.tokens[token] = secret;
  }
  entries() {
    return Object.entries(this.data.tokens);
  }
  isMasked(root: string) {
    return !!this.data.masked[resolve(root)];
  }
  setMasked(root: string, masked: boolean) {
    if (masked) this.data.masked[resolve(root)] = true;
    else delete this.data.masked[resolve(root)];
  }

  /** Atomic write: never leaves a half-written vault behind. */
  flush() {
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
}

/** In-memory vault for tests. */
export class MemoryVault implements Vault {
  private tokens = new Map<string, string>();
  private masked = new Set<string>();
  constructor(readonly key = 'test-key') {}
  get(t: string) { return this.tokens.get(t); }
  put(t: string, s: string) { this.tokens.set(t, s); }
  entries() { return this.tokens.entries(); }
  isMasked(r: string) { return this.masked.has(resolve(r)); }
  setMasked(r: string, m: boolean) { m ? this.masked.add(resolve(r)) : this.masked.delete(resolve(r)); }
  flush() {}
}
