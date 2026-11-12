export * from './types';
export { KeyValueDetector } from './detection/keyValueDetector';
export { PatternDetector, BUILTIN_RULES, type PatternRule } from './detection/patternDetector';
export { HmacTokenizer } from './tokenizer/hmacTokenizer';
export { FileVault, MemoryVault, defaultVaultPath } from './vault/fileVault';
export { Masker } from './masker';
export { Workspace, DEFAULT_EXTENSIONS, type Mode, type WorkspaceOptions } from './workspace';

import { KeyValueDetector } from './detection/keyValueDetector';
import { PatternDetector } from './detection/patternDetector';
import { HmacTokenizer } from './tokenizer/hmacTokenizer';
import { FileVault } from './vault/fileVault';
import { Masker } from './masker';
import { Workspace } from './workspace';
import type { Vault } from './types';

/** Composition root: wires the default detectors, tokenizer and vault together. */
export function createWorkspace(root: string, vault: Vault = new FileVault()): Workspace {
  const masker = new Masker([new KeyValueDetector(), new PatternDetector()], new HmacTokenizer(vault.key), vault);
  return new Workspace(root, masker, vault);
}

export function createMasker(vault: Vault = new FileVault()): Masker {
  return new Masker([new KeyValueDetector(), new PatternDetector()], new HmacTokenizer(vault.key), vault);
}
