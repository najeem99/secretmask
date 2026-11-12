import type { Detector, Finding, Tokenizer, Vault } from './types';

/** Shortest secret we will propagate by plain string match (avoids masking "abc" everywhere). */
const MIN_PROPAGATE_LENGTH = 6;

/**
 * Masks and unmasks text. Pure apart from writing new tokens into the vault;
 * knows nothing about files, git or editors.
 */
export class Masker {
  constructor(
    private readonly detectors: Detector[],
    private readonly tokenizer: Tokenizer,
    private readonly vault: Vault,
  ) {}

  mask(text: string): string {
    const findings = this.collect(text);
    let out = '';
    let pos = 0;
    for (const f of findings) {
      out += text.slice(pos, f.start) + this.tokenFor(f.value);
      pos = f.end;
    }
    out += text.slice(pos);
    return this.propagateKnown(out);
  }

  unmask(text: string): string {
    return text.replace(this.tokenizer.tokenPattern, (t) => this.vault.get(t) ?? t);
  }

  private tokenFor(secret: string): string {
    const token = this.tokenizer.tokenize(secret);
    this.vault.put(token, secret);
    return token;
  }

  /** All detector findings, minus tokens and overlaps (first, longest wins). */
  private collect(text: string): Finding[] {
    const all = this.detectors
      .flatMap((d) => d.detect(text))
      .filter((f) => !this.tokenizer.isToken(f.value))
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const kept: Finding[] = [];
    for (const f of all) {
      const last = kept[kept.length - 1];
      if (!last || f.start >= last.end) kept.push(f);
    }
    return kept;
  }

  /** A secret the vault already knows, copied somewhere new, gets the same token. */
  private propagateKnown(text: string): string {
    let out = text;
    for (const [token, secret] of this.vault.entries()) {
      if (secret.length >= MIN_PROPAGATE_LENGTH && out.includes(secret)) {
        out = out.split(secret).join(token);
      }
    }
    return out;
  }
}
