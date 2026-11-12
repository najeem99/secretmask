# SecretMask

**Hide secrets from AI coding agents without changing how you work.**

AI agents like Claude Code, Copilot and Cursor read your files, including the passwords and API keys in them. SecretMask swaps every secret for a token while the AI works, then puts the real values back when it's done. Your git history and diffs never notice.

```yaml
# on disk while you work            # on disk while Claude works
password: Claude123                 password: SECRET_9a1a8d2ab1faf777
access-key: AKIAABCDEFGHIJKLMNOP    access-key: SECRET_eda626589be03f95
url: ${DB_URL}                      url: ${DB_URL}      # placeholders left alone
```

## Features
- **Same secret, same token.** HMAC-SHA256 under a per-machine key. If the AI copies a token somewhere new, SecretMask restores it there too.
- **One-way.** Tokens reveal nothing. Real values live only in `~/.secretmask/`, never in your project.
- **Automatic with Claude Code.** Masks at session start, re-masks after every edit, unmasks at session end.
- **Invisible to git.** A local clean filter makes masking show up as *no change*. Only real code edits appear in your diff.
- **Cross-platform** on Windows, macOS and Linux. Nothing is committed to your repo.

## Install

**VS Code / Cursor / Windsurf:** install *SecretMask* from the Marketplace or Open VSX, open your project, then run **`SecretMask: Set Up Everything`**.

**CLI only:**
```bash
npm i -g secretmask
secretmask mask      # hide
secretmask unmask    # restore
```
For manual hook and git setup, see [`integrations/`](integrations).

## Detects
- Secret-looking keys (`password`, `secret`, `token`, `api_key`, `access_key`, `client_secret`…) in `.yml`, `.properties`, `.env`, `.java`, `.json`, `.xml`, `.ts`, `.py` and more
- Known formats anywhere: AWS key IDs, GitHub, OpenAI/Anthropic, Slack and Google keys, and `user:password@host` URLs

## Good to know
- Your app **won't run while masked**. Add [`integrations/claude-code/CLAUDE.md.snippet`](integrations/claude-code/CLAUDE.md.snippet) to your `CLAUDE.md`.
- This is a guard, not a vault. Read the [threat model](docs/threat-model.md).

## Repo layout
```
packages/core     pure masking logic (detectors, tokenizer, vault, masker)
packages/cli      `secretmask` command: hooks + git filter
packages/vscode   VS Code extension (thin UI over core)
integrations/     Claude Code & git setup templates
examples/         fake Spring Boot project used by the e2e test
docs/             architecture, threat model
```
More detail in [docs/architecture.md](docs/architecture.md).

## Develop
```bash
npm install
npm test          # unit tests + end-to-end git test
npm run package   # builds packages/vscode/*.vsix
```

Contributions welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed.
