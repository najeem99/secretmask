'use strict';
// SecretMask core: reversible, deterministic tokenization of secrets.
// Shared by the VS Code extension, the CLI (Claude Code hooks) and the git filter.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const VAULT_DIR = process.env.SECRETMASK_HOME || path.join(os.homedir(), '.secretmask');
const VAULT_FILE = path.join(VAULT_DIR, 'vault.json');
const TOKEN_RE = /SECRET_[0-9a-f]{16}/g;

const DEFAULT_EXTS = ['.yml', '.yaml', '.properties', '.env', '.java', '.kt', '.xml', '.json',
  '.js', '.ts', '.py', '.go', '.cs', '.rb', '.php', '.sql', '.toml', '.ini', '.conf', '.cfg', '.tf'];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'target', 'build', 'dist', 'out', '.idea', '.vscode', '.gradle', 'venv', '.venv']);

// key = value / key: value / "key": "value" where key looks secret-ish
const KEY_NAMES = '(?:[\\w.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|credential|auth)[\\w.-]*)';
const ASSIGN_RE = new RegExp(
  '(["\']?' + KEY_NAMES + '["\']?\\s*(?:=|:|:=)\\s*)(["\']?)(?![$<{])([^"\'\\s,;#}\\]]{4,})(\\2)', 'gi');
// Well-known secret formats, matched anywhere
const PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/g,                         // AWS access key id
  /\bASIA[0-9A-Z]{16}\b/g,                         // AWS temp key id
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,               // GitHub tokens
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g,           // OpenAI / Anthropic keys
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,             // Slack
  /\bAIza[0-9A-Za-z_-]{35}\b/g,                    // Google API key
  /(?<=:\/\/[^:\/\s@]+:)[^@\s\/]{3,}(?=@)/g        // password inside user:pass@host URLs
];

function loadVault() {
  if (!fs.existsSync(VAULT_FILE)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
    const v = { key: crypto.randomBytes(32).toString('hex'), tokens: {}, masked: {} };
    saveVault(v);
    return v;
  }
  return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
}
function saveVault(v) {
  fs.mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
  const tmp = VAULT_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, VAULT_FILE);
}

function tokenFor(vault, secret) {
  const t = 'SECRET_' + crypto.createHmac('sha256', vault.key).update(secret).digest('hex').slice(0, 16);
  vault.tokens[t] = secret;
  return t;
}

function isPlaceholder(v) {
  return /^\$\{.*\}$|^\$[A-Z_]+$|^<.*>$|^(changeme|xxx+|\*+|null|none|true|false|example|your[_-].*)$/i.test(v)
    || /^SECRET_[0-9a-f]{16}$/.test(v);
}

function maskText(vault, text) {
  let out = text.replace(ASSIGN_RE, (m, pre, q, val, q2) =>
    isPlaceholder(val) ? m : pre + q + tokenFor(vault, val) + q2);
  for (const re of PATTERNS) {
    out = out.replace(re, (val) => (/^SECRET_/.test(val) ? val : tokenFor(vault, val)));
  }
  // Any secret already known (e.g. copied elsewhere) gets the same token
  for (const [tok, val] of Object.entries(vault.tokens)) {
    if (val.length >= 6 && out.includes(val)) out = out.split(val).join(tok);
  }
  return out;
}

function unmaskText(vault, text) {
  return text.replace(TOKEN_RE, (t) => (t in vault.tokens ? vault.tokens[t] : t));
}

function* walk(dir, exts) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walk(p, exts); }
    else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (exts.includes(ext) || e.name.startsWith('.env')) yield p;
    }
  }
}

function processDir(root, mode, exts = DEFAULT_EXTS) {
  const vault = loadVault();
  const changed = [];
  for (const file of walk(root, exts)) {
    let st; try { st = fs.statSync(file); } catch { continue; }
    if (st.size > 2 * 1024 * 1024) continue;
    const src = fs.readFileSync(file, 'utf8');
    if (src.includes('\u0000')) continue; // binary
    const out = mode === 'mask' ? maskText(vault, src) : unmaskText(vault, src);
    if (out !== src) { fs.writeFileSync(file, out); changed.push(file); }
  }
  const key = path.resolve(root);
  if (mode === 'mask') vault.masked[key] = true; else delete vault.masked[key];
  saveVault(vault);
  refreshGit(root, changed);
  return changed;
}

// Masking changes file sizes, which makes `git status` flag files without running the
// clean filter. For each touched file whose filtered content equals the index blob,
// re-add it: nothing new is staged, git just records the new stat info.
function refreshGit(root, files) {
  if (!fs.existsSync(path.join(root, '.git')) || !files.length) return;
  const cp = require('child_process');
  const git = (args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  for (const f of files) {
    try {
      const rel = path.relative(root, f).split(path.sep).join('/');
      const staged = git(['ls-files', '-s', '--', rel]).split(/\s+/)[1];
      if (!staged) continue;
      if (git(['hash-object', '--path=' + rel, '--', rel]) === staged) git(['add', '--', rel]);
    } catch {}
  }
}

function isMasked(root) {
  if (!fs.existsSync(VAULT_FILE)) return false;
  return !!loadVault().masked[path.resolve(root)];
}

module.exports = { loadVault, saveVault, maskText, unmaskText, processDir, isMasked, VAULT_FILE, DEFAULT_EXTS };
