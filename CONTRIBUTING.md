# Contributing

1. `npm install`, then `npm test`. Both the unit and e2e tests must pass.
2. Keep security logic in `packages/core`. Adapters (`cli`, `vscode`) stay thin.
3. New secret format? Add a rule to `BUILTIN_RULES` in `packages/core/src/detection/patternDetector.ts`, with a test. Use **fake** values only.
4. Every operation must stay idempotent and must never block the user's tool. See [docs/architecture.md](docs/architecture.md).
5. Use one PR per change, and update `CHANGELOG.md`.
