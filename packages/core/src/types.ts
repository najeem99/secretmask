/** A secret value located inside a piece of text. */
export interface Finding {
  /** Start offset of the secret value in the text. */
  start: number;
  /** End offset (exclusive). */
  end: number;
  /** The raw secret value. */
  value: string;
  /** Id of the detector rule that found it, e.g. "aws-access-key-id". */
  rule: string;
}

/** Finds secrets in text. Detectors must be pure: no I/O, no state. */
export interface Detector {
  readonly id: string;
  detect(text: string): Finding[];
}

/** Turns a secret into a stable, irreversible token. */
export interface Tokenizer {
  tokenize(secret: string): string;
  /** Regex (global) that matches any token this tokenizer can produce. */
  readonly tokenPattern: RegExp;
  isToken(value: string): boolean;
}

/** Stores the token → secret mapping, outside the project. */
export interface Vault {
  get(token: string): string | undefined;
  put(token: string, secret: string): void;
  entries(): Iterable<[string, string]>;
  isMasked(root: string): boolean;
  setMasked(root: string, masked: boolean): void;
  /** Secret key used by the tokenizer. Never leaves the machine. */
  readonly key: string;
  flush(): void;
}
