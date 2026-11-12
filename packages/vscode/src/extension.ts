import * as vscode from 'vscode';
import { join } from 'node:path';
import { createWorkspace, type Mode } from '@secretmask/core';
import { installClaudeHooks, installGitFilter } from './setup';

let status: vscode.StatusBarItem;
let cliPath: string;

function root(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function refreshStatus() {
  const r = root();
  if (!r) return status.hide();
  const masked = createWorkspace(r).isMasked();
  status.text = masked ? '$(lock) Secrets masked' : '$(unlock) Secrets visible';
  status.tooltip = 'SecretMask: click to toggle';
  status.backgroundColor = masked ? undefined : new vscode.ThemeColor('statusBarItem.warningBackground');
  status.show();
}

async function run(mode: Mode) {
  const r = root();
  if (!r) return void vscode.window.showWarningMessage('SecretMask: open a folder first.');
  await vscode.workspace.saveAll(false);
  const changed = createWorkspace(r).run(mode);
  refreshStatus();
  vscode.window.setStatusBarMessage(`SecretMask: ${mode}ed ${changed.length} file(s)`, 4000);
}

function guarded(fn: (r: string) => void, ok: string) {
  return () => {
    const r = root();
    if (!r) return;
    try {
      fn(r);
      vscode.window.showInformationMessage(ok);
    } catch (e) {
      vscode.window.showErrorMessage(`SecretMask: ${(e as Error).message}`);
    }
  };
}

export function activate(ctx: vscode.ExtensionContext) {
  cliPath = join(ctx.extensionPath, 'dist', 'secretmask.js');
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = 'secretmask.toggle';

  const setupClaude = guarded((r) => installClaudeHooks(r, cliPath),
    'SecretMask: Claude Code hooks installed. Secrets are masked while Claude runs.');
  const setupGit = guarded((r) => installGitFilter(r, cliPath),
    'SecretMask: git filter installed. Masked files will not show as changed.');

  ctx.subscriptions.push(
    status,
    vscode.commands.registerCommand('secretmask.mask', () => run('mask')),
    vscode.commands.registerCommand('secretmask.unmask', () => run('unmask')),
    vscode.commands.registerCommand('secretmask.toggle', () =>
      run(root() && createWorkspace(root()!).isMasked() ? 'unmask' : 'mask')),
    vscode.commands.registerCommand('secretmask.setupClaude', setupClaude),
    vscode.commands.registerCommand('secretmask.setupGit', setupGit),
    vscode.commands.registerCommand('secretmask.setupAll', () => { setupClaude(); setupGit(); }),
  );

  // Hooks run outside VS Code, so poll the vault for state changes.
  const timer = setInterval(refreshStatus, 2000);
  ctx.subscriptions.push({ dispose: () => clearInterval(timer) });
  refreshStatus();
}

export function deactivate() {}
