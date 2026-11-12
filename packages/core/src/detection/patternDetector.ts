import type { Detector, Finding } from '../types';

export interface PatternRule {
  id: string;
  pattern: RegExp; // must be global
}

/** Well-known secret formats, matched anywhere in the text. */
export const BUILTIN_RULES: PatternRule[] = [
  { id: 'aws-access-key-id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { id: 'llm-api-key', pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'url-password', pattern: /(?<=:\/\/[^:/\s@]+:)[^@\s/]{3,}(?=@)/g },
];

export class PatternDetector implements Detector {
  readonly id = 'pattern';
  constructor(private readonly rules: PatternRule[] = BUILTIN_RULES) {}

  detect(text: string): Finding[] {
    const findings: Finding[] = [];
    for (const rule of this.rules) {
      for (const m of text.matchAll(rule.pattern)) {
        findings.push({ start: m.index!, end: m.index! + m[0].length, value: m[0], rule: rule.id });
      }
    }
    return findings;
  }
}
