'use strict';
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const core = require('./core');

let statusItem;
const CLI = path.join(__dirname, 'cli.js');
const HOOK_TAG = 'secretmask';

function root() {
  const f = vscode.workspace.workspaceFolders;
  return f && f.length ? f[0].uri.fsPath : undefined;
}

function refreshStatus() {
  const r = root();
  if (!r) { statusItem.hide(); return; }
  const masked = core.isMasked(r);
  statusItem.text = masked ? '$(lock) Secrets masked' : '$(unlock) Secrets visible';
  statusItem.tooltip = 'SecretMask: click to toggle';
  statusItem.backgroundColor = masked ? undefined : new vscode.ThemeColor('statusBarItem.warningBackground');
  statusItem.show();
}

async function run(mode) {
  const r = root();
  if (!r) return vscode.window.showWarningMessage('SecretMask: open a folder first.');
  await vscode.workspace.saveAll(false);
  const files = core.processDir(r, mode);
  refreshStatus();
  vscode.window.setStatusBarMessage(`SecretMask: ${mode}ed ${files.length} file(s)`, 4000);
}

function nodeCmd(args) {
  // Absolute path to node + cli, quoted for both POSIX shells and Windows cmd
  return `node "${CLI}" ${args}`;
}

async function setupClaudeHooks() {
  const r = root();
  if (!r) return;
  const file = path.join(r, '.claude', 'settings.local.json'); // local = not committed
  let s = {};
  if (fs.existsSync(file)) { try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {} }
  s.hooks = s.hooks || {};
  const add = (event, matcher, args) => {
    const list = (s.hooks[event] = (s.hooks[event] || []).filter(
      (h) => !JSON.stringify(h).includes(HOOK_TAG)));
    const entry = { hooks: [{ type: 'command', command: nodeCmd(args) + ' # ' + HOOK_TAG }] };
    if (matcher) entry.matcher = matcher;
    list.push(entry);
  };
  add('SessionStart', null, 'mask');
  add('PostToolUse', 'Write|Edit|MultiEdit', 'mask');
  add('SessionEnd', null, 'unmask');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
  vscode.window.showInformationMessage(
    'SecretMask: Claude Code hooks installed in .claude/settings.local.json. Secrets will be masked while Claude runs.');
}

async function setupGitFilter() {
  const r = root();
  if (!r || !fs.existsSync(path.join(r, '.git'))) {
    return vscode.window.showWarningMessage('SecretMask: no git repository in this folder.');
  }
  const git = (args) => cp.execFileSync('git', args, { cwd: r });
  git(['config', 'filter.secretmask.clean', nodeCmd('clean')]);
  git(['config', 'filter.secretmask.smudge', 'cat']);
  // .git/info/attributes is local and never committed
  const attr = path.join(r, '.git', 'info', 'attributes');
  fs.mkdirSync(path.dirname(attr), { recursive: true });
  let cur = fs.existsSync(attr) ? fs.readFileSync(attr, 'utf8') : '';
  if (!cur.includes('filter=secretmask')) {
    const lines = core.DEFAULT_EXTS.map((e) => `*${e} filter=secretmask`).concat('.env* filter=secretmask');
    cur += (cur && !cur.endsWith('\n') ? '\n' : '') + '# secretmask\n' + lines.join('\n') + '\n';
    fs.writeFileSync(attr, cur);
  }
  try { git(['add', '--renormalize', '--dry-run', '.']); } catch {}
  vscode.window.showInformationMessage('SecretMask: git filter installed. Masked files will not show as changed.');
}

function activate(context) {
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.command = 'secretmask.toggle';
  context.subscriptions.push(
    statusItem,
    vscode.commands.registerCommand('secretmask.mask', () => run('mask')),
    vscode.commands.registerCommand('secretmask.unmask', () => run('unmask')),
    vscode.commands.registerCommand('secretmask.toggle', () => run(core.isMasked(root() || '') ? 'unmask' : 'mask')),
    vscode.commands.registerCommand('secretmask.setupClaude', setupClaudeHooks),
    vscode.commands.registerCommand('secretmask.setupGit', setupGitFilter),
    vscode.commands.registerCommand('secretmask.setupAll', async () => { await setupClaudeHooks(); await setupGitFilter(); })
  );
  // Vault changes come from hooks running outside VS Code; poll lightly
  {
    const t = setInterval(refreshStatus, 2000);
    context.subscriptions.push({ dispose: () => clearInterval(t) });
  }
  refreshStatus();
}

function deactivate() {}
module.exports = { activate, deactivate };
