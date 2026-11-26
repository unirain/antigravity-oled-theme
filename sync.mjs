#!/usr/bin/env node
/**
 * antigravity-oled-theme · Profile Sync CLI
 *
 * Usage:
 *   node sync.mjs apply   Apply this repository's user/ profile to ~/.gemini/antigravity/codex-theme/user/
 *   node sync.mjs pull    Pull live ~/.gemini/antigravity/codex-theme/user/ files back into this repo (sanitizing sshHosts)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_USER_DIR = path.join(__dirname, 'user');
const TARGET_BASE_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'codex-theme');
const TARGET_USER_DIR = path.join(TARGET_BASE_DIR, 'user');
const MANAGED_FILES = ['config.json', 'custom.css', 'custom.js'];

const cmd = process.argv[2] || 'help';

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function applyProfile() {
  if (!fs.existsSync(TARGET_BASE_DIR)) {
    console.error(
      `[ERROR] ${TARGET_BASE_DIR} not found.\n` +
        'Please install antigravity-codex-theme first:\n' +
        '  git clone --depth=1 --filter=blob:none --sparse https://github.com/nkjDSLcvanv/antigravity-codex-theme.git\n' +
        '  cd antigravity-codex-theme && git sparse-checkout set core user && node install.mjs install'
    );
    process.exit(1);
  }

  fs.mkdirSync(TARGET_USER_DIR, { recursive: true });

  // Backup existing target user files if any exist
  const existing = MANAGED_FILES.filter((f) => fs.existsSync(path.join(TARGET_USER_DIR, f)));
  let backupDir = null;
  if (existing.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupDir = path.join(TARGET_BASE_DIR, 'backups', `user-profile-${stamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    for (const f of existing) {
      fs.copyFileSync(path.join(TARGET_USER_DIR, f), path.join(backupDir, f));
    }
  }

  // Preserve user's local sshHosts when applying config.json
  const existingCfg = readJsonSafe(path.join(TARGET_USER_DIR, 'config.json'));
  const repoCfg = readJsonSafe(path.join(REPO_USER_DIR, 'config.json'));
  if (repoCfg) {
    const nextCfg = structuredClone(repoCfg);
    if (existingCfg && Array.isArray(existingCfg.sshHosts) && existingCfg.sshHosts.length > 0) {
      nextCfg.sshHosts = existingCfg.sshHosts;
    }
    fs.writeFileSync(path.join(TARGET_USER_DIR, 'config.json'), JSON.stringify(nextCfg, null, 2) + '\n', 'utf8');
  }

  for (const f of ['custom.css', 'custom.js']) {
    const src = path.join(REPO_USER_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(TARGET_USER_DIR, f));
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'apply',
        targetUserDir: TARGET_USER_DIR,
        backupDir,
        note: 'Changes hot-reload automatically within ~2.5s when the codex-theme daemon is running.'
      },
      null,
      2
    )
  );
}

function pullProfile() {
  if (!fs.existsSync(TARGET_USER_DIR)) {
    console.error(`[ERROR] ${TARGET_USER_DIR} does not exist.`);
    process.exit(1);
  }
  fs.mkdirSync(REPO_USER_DIR, { recursive: true });

  const liveCfg = readJsonSafe(path.join(TARGET_USER_DIR, 'config.json'));
  if (liveCfg) {
    liveCfg.sshHosts = [];
    fs.writeFileSync(path.join(REPO_USER_DIR, 'config.json'), JSON.stringify(liveCfg, null, 2) + '\n', 'utf8');
  }

  for (const f of ['custom.css', 'custom.js']) {
    const src = path.join(TARGET_USER_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(REPO_USER_DIR, f));
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'pull',
        repoUserDir: REPO_USER_DIR,
        sanitizedFields: ['sshHosts']
      },
      null,
      2
    )
  );
}

switch (cmd) {
  case 'apply':
    applyProfile();
    break;
  case 'pull':
    pullProfile();
    break;
  default:
    console.log(`antigravity-oled-theme · Profile Sync CLI
  node sync.mjs apply   Apply repo user/ profile -> ~/.gemini/antigravity/codex-theme/user/
  node sync.mjs pull    Pull live config -> repo user/ (sanitizes sshHosts)`);
    break;
}
