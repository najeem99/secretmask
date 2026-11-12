import type { Detector, Finding } from '../types';

const SECRET_KEY_WORDS =
  'password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|credential|auth';

/** Values that are clearly not real secrets. */
const PLACEHOLDER =
  /^(\$\{.*\}?|\$[A-Z_]+|<.*>|changeme|x{3,}|\*+|null|none|true|false|example|your[_-].*)$/i;

/**
 * Finds `key = value`, `key: value` and `"key": "value"` where the key name
 * looks like it holds a secret. Works for .properties, .yml, .env, JSON and most code.
 */
export class KeyValueDetector implements Detector {
  readonly id = 'key-value';
  private readonly re: RegExp;

  constructor(extraKeyWords: string[] = []) {
    const words = [SECRET_KEY_WORDS, ...extraKeyWords].join('|');
    // group 1: prefix up to the value, group 2: opening quote, group 3: value
    this.re = new RegExp(
      `(["']?[\\w.-]*(?:${words})[\\w.-]*["']?\\s*(?:=|:|:=)\\s*)(["']?)(?![$<{])([^"'\\s,;#}\\]]{4,})\\2`,
      'gi',
    );
  }

  detect(text: string): Finding[] {
    const findings: Finding[] = [];
    for (const m of text.matchAll(this.re)) {
      const value = m[3];
      if (PLACEHOLDER.test(value)) continue;
      const start = m.index! + m[1].length + m[2].length;
      findings.push({ start, end: start + value.length, value, rule: this.id });
    }
    return findings;
  }
}
