/**
 * 文档门禁：防止文档与代码漂移。
 *
 * 这个项目里最容易腐烂的三类说法，都由本脚本机械校验：
 *   1. 文档提到的仓库内路径必须存在（重命名文件后忘了改文档，立刻红）。
 *   2. 文档里的 `pnpm <script>` 必须是真实存在的 script（写了不存在的命令，立刻红）。
 *   3. 文档里的相对 Markdown 链接必须指向存在的文件。
 *
 * 用法：node scripts/verify-docs.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 文档扫描范围：仓库内的维护文档。 */
function collectDocs() {
  const docs = ['AGENTS.md', 'CONTEXT.md', 'README.md'];
  for (const dir of ['docs', 'packages', 'apps']) {
    const walk = (current) => {
      for (const entry of readdirSync(current)) {
        const full = join(current, entry);
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) {
          continue;
        }
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (entry.endsWith('.md')) {
          docs.push(full.slice(ROOT.length + 1));
        }
      }
    };
    walk(join(ROOT, dir));
  }
  return [...new Set(docs)].filter((doc) => existsSync(join(ROOT, doc)));
}

/** 所有 package.json 里真实存在的 script 名。 */
function collectScriptNames() {
  const manifests = ['package.json', 'packages/core/package.json', 'apps/web/package.json'];
  const names = new Set();
  for (const manifest of manifests) {
    const parsed = JSON.parse(readFileSync(join(ROOT, manifest), 'utf8'));
    for (const name of Object.keys(parsed.scripts ?? {})) {
      names.add(name);
    }
  }
  return names;
}

const failures = [];

function checkPath(doc, target) {
  if (!existsSync(join(ROOT, target))) {
    failures.push(`${doc}: 提到不存在的路径 ${target}`);
  }
}

function checkScript(doc, name, known) {
  // `pnpm install` / `pnpm exec` / `pnpm --filter` 这类是 pnpm 自带命令，不是仓库 script。
  const builtins = new Set(['install', 'exec', 'dlx', 'add', 'remove', 'why', 'store', 'config', 'publish']);
  if (builtins.has(name) || known.has(name)) {
    return;
  }
  failures.push(`${doc}: 提到不存在的 script「pnpm ${name}」`);
}

function checkLink(doc, target) {
  if (/^(https?:|#|mailto:)/.test(target)) {
    return;
  }
  const clean = target.split('#')[0];
  if (clean === '') {
    return;
  }
  const resolved = resolve(ROOT, dirname(doc), clean);
  if (!existsSync(resolved)) {
    failures.push(`${doc}: 失效的链接 ${target}`);
  }
}

const docs = collectDocs();
const scripts = collectScriptNames();

/** 文档里故意提到、但并非调用命令的写法（例如「不要用 `pnpm docs` 这个 script 名」）。 */
const COMMAND_MENTION_ALLOWLIST = new Set(['docs']);

for (const doc of docs) {
  const raw = readFileSync(join(ROOT, doc), 'utf8');

  // 1. 反引号里的仓库内路径
  for (const match of raw.matchAll(/`((?:packages|apps|docs|scripts|\.agents)\/[A-Za-z0-9_./-]+?)(?::\d+(?:-\d+)?)?`/g)) {
    checkPath(doc, match[1]);
  }

  // 2. `pnpm <script>`：查全文。
  //    表格与列表里的命令常写在行内代码中，跳过行内代码会漏掉真实笔误，
  //    因此默认全查，只豁免显式登记的「提及而非调用」写法。
  for (const match of raw.matchAll(/\bpnpm (?:run )?([a-z][a-z0-9:-]*)/g)) {
    if (COMMAND_MENTION_ALLOWLIST.has(match[1])) {
      continue;
    }
    checkScript(doc, match[1], scripts);
  }

  // 3. 相对 Markdown 链接
  for (const match of raw.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    checkLink(doc, match[1]);
  }
}

if (failures.length > 0) {
  console.error('文档校验失败：');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`文档校验通过：${docs.length} 份文档，路径/命令/链接均有效。`);
