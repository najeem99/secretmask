# SecretMask: Hide Secrets from AI

AI coding agents like Claude Code, Copilot and Cursor read your files, including the passwords and API keys in them. **SecretMask swaps every secret for a token while the AI works, then puts the real values back when it's done.** Your git history and diffs never notice.

```yaml
# what you see                     # what Claude sees
password: Claude123                password: SECRET_9a1a8d2ab1faf777
access-key: AKIAABCDEFGHIJKLMNOP   access-key: SECRET_eda626589be03f95
url: ${DB_URL}                     url: ${DB_URL}        # placeholders left alone
```

## How it works

- **Same secret, same token.** Each token is an HMAC-SHA256 of the secret under a random key that never leaves your machine. If the AI copies a token into a new file or variable, SecretMask restores it there too.
- **The AI can't reverse it.** Tokens are one-way. Real values live only in `~/.secretmask/vault.json` (mode 600), outside your project.
- **Automatic with Claude Code.** Hooks mask secrets at `SessionStart`, re-mask after every `Write`/`Edit`, and unmask at `SessionEnd`.
- **Git stays clean.** A local git clean filter restores real values before git compares files, so masking shows up as *no change*. Only real code edits appear in your diff.

## Setup

1. Install the extension.
2. Open your project and run **`SecretMask: Set Up Everything`** from the Command Palette.
   - Writes hooks to `.claude/settings.local.json` (not committed)
   - Writes the git filter to `.git/config` and `.git/info/attributes` (not committed)
3. Click the lock icon in the status bar to toggle by hand at any time.

## What gets detected

- Assignments whose key looks secret: `password`, `pwd`, `secret`, `token`, `api_key`, `access_key`, `private_key`, `client_secret`, `credential`, `auth`... in `.yml`, `.properties`, `.env`, `.java`, `.json`, `.xml`, `.ts`, `.py` and more
- Known formats anywhere: AWS key IDs (`AKIA…`), GitHub tokens, OpenAI/Anthropic keys, Slack tokens, Google API keys, and `user:password@host` URLs
- Skipped: `${VAR}` placeholders, `changeme`, `<your-key>`, and similar

## Limits (read these)

- **Your app won't run while masked.** It would try to connect with the tokens. Tell your AI this in `CLAUDE.md`.
- **This is a guard, not a vault.** Anything on your machine that can read `~/.secretmask/vault.json` can read your secrets. The best fix is still to keep secrets out of the repo.
- If a session crashes before `SessionEnd`, run **`SecretMask: Unmask Secrets`**. Unmasking is always safe to run.
- After an extension update, run **Set Up Everything** again, because the hook path includes the extension version.
- Requires `node` on your PATH, which the hooks and the git filter use.

## CLI

```
node src/cli.js mask|unmask|status [dir]
node src/cli.js clean        # git filter: stdin -> stdout
```

MIT licensed. Contributions welcome.
