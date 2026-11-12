# Threat model

## What SecretMask protects against
- An AI coding agent **reading** secrets from project files and sending them to a model provider, logs or chat history.
- An AI agent **writing** a real secret into a new file (re-masked after every edit).
- Secrets showing up in AI-generated diffs, PR descriptions or summaries.

## What it does NOT protect against
- **Other processes on your machine.** Anything that can read `~/.secretmask/vault.json` can read your secrets.
- **Secrets outside the project folder** (e.g. `~/.aws/credentials`). Use your AI tool's own deny rules for those.
- **Secrets in environment variables or shell history** that the agent can print.
- **Secrets the agent sees at runtime**, for example if it runs a command that prints config from a live service.
- **Formats the detectors don't recognise.** Detection is heuristic; add custom rules for your own formats.
- **A crash between mask and unmask.** Files stay masked (safe, but your app won't run) until the next `mask`/`unmask`.

## Token properties
- `SECRET_` + first 64 bits of `HMAC-SHA256(key, secret)`. The key is 256 random bits, generated per machine.
- Equal secrets give equal tokens, which reveals that two values are the same. That is intended: it lets the agent copy a token correctly.
- 64 bits make accidental collisions negligible for realistic numbers of secrets per machine.

## Roadmap
- Encrypt the vault at rest (AES-256-GCM), with the key in the OS keychain
- Per-project `.secretmaskrc` rules and allowlists
- Audit log of mask/unmask events

Report vulnerabilities privately; see [SECURITY.md](../SECURITY.md).
