# Architecture

SecretMask is a small **ports-and-adapters** design. All security logic lives in `@secretmask/core`, which has no dependency on VS Code, git or Claude Code. Everything else is a thin adapter.

```
            ┌──────────────── adapters ────────────────┐
  VS Code ext (packages/vscode)    CLI (packages/cli)
   commands, status bar,            mask | unmask | status | clean
   setup wizard                     ▲            ▲
        │                           │            │
        │                 Claude Code hooks   git clean filter
        ▼                           │            │
  ┌──────────────────── @secretmask/core ─────────────────────┐
  │  Workspace  ── walks files, writes, refreshes git index   │
  │     │                                                     │
  │  Masker     ── mask(text) / unmask(text), overlap rules   │
  │   │      │       │                                        │
  │ Detector Tokenizer Vault       (interfaces in types.ts)   │
  │  ├ KeyValueDetector   HmacTokenizer   FileVault           │
  │  └ PatternDetector                    MemoryVault (tests) │
  └───────────────────────────────────────────────────────────┘
```

## Components

| Component | Responsibility | Swappable? |
|---|---|---|
| `Detector` | Find secret values in text. Pure, no state. | Add new detectors for new formats |
| `Tokenizer` | `secret → SECRET_<16 hex>`, deterministic and one-way (HMAC-SHA256) | Yes |
| `Vault` | Store `token → secret` and per-project masked state, outside the project | `FileVault` now; keychain-backed / encrypted next |
| `Masker` | Combine detectors, resolve overlaps, tokenize, propagate known secrets | — |
| `Workspace` | Apply the masker to files in a folder; keep `git status` clean | — |
| `createWorkspace()` | Composition root: the only place the defaults are wired together | — |

## Lifecycle with Claude Code

```
SessionStart ──► secretmask mask      (also heals a previous crashed session)
  Claude reads files → sees only SECRET_… tokens
PostToolUse(Write|Edit) ──► secretmask mask   (catches a secret Claude typed in)
SessionEnd ──► secretmask unmask      (real values back on disk)
```

## Why git doesn't see masking

`.git/info/attributes` routes files through `secretmask clean`, which **unmasks** content before git hashes it. A masked file therefore hashes to the same blob as the original. Masking also changes file size, which makes `git status` skip the filter, so `Workspace` re-adds any file whose filtered hash equals its staged blob. That stages nothing new; it only refreshes git's stat cache.

## Design rules

1. `core` must not import `vscode`, spawn editors or read config from the environment (except `SECRETMASK_HOME`).
2. Every operation is **idempotent**: masking a masked file or unmasking a clean file is a no-op.
3. Adapters must **never block** the user's tool. CLI errors exit 0 and print to stderr.
4. Nothing SecretMask writes in a project is committed (`settings.local.json`, `.git/config`, `.git/info/attributes`).
