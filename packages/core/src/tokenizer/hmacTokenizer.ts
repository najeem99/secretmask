import { createHmac } from 'node:crypto';
import type { Tokenizer } from '../types';

/**
 * Deterministic, one-way tokens: the same secret always maps to the same
 * token under a given key, and the token reveals nothing about the secret.
 */
export class HmacTokenizer implements Tokenizer {
  static readonly PREFIX = 'SECRET_';
  readonly tokenPattern = /SECRET_[0-9a-f]{16}/g;

  constructor(private readonly key: string) {
    if (!key) throw new Error('HmacTokenizer needs a key');
  }

  tokenize(secret: string): string {
    const digest = createHmac('sha256', this.key).update(secret).digest('hex');
    return HmacTokenizer.PREFIX + digest.slice(0, 16);
  }

  isToken(value: string): boolean {
    return /^SECRET_[0-9a-f]{16}$/.test(value);
  }
}
