/**
 * 文档门禁：防止文档与代码漂移。
 *
 * 这个项目里最容易腐烂的三类说法，都由本脚本机械校验：
 *   1. 文档提到的仓库内路径必须存在（重命名文件后忘了改文档，立刻红）。
 *   2. 文档里的 `pnpm <script>` 必须是真实存在的 script（写了不存在的命令，立刻红）。
 *   3. 文档里的相对 Markdown 链接必须指向存在的文件。
 *
 * 例外：被 gitignore 的路径（`apps/web/dist/`、`node_modules/`、`.pnpm-store/` 这类构建产物与依赖目录）
 * 在干净检出上本来就不存在，文档里提到它们是合理的（例如「不要提交 …」），所以跳过不查——
 * 否则新克隆的人第一次跑 `pnpm test:docs` 就会红。
 *
 * 用法：node scripts/verify-docs.mjs
 */

import { execFileSync } from 'node:child_process';
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

/**
 * 该路径是否被 gitignore（构建产物、依赖目录）。git 不可用时按「没被忽略」处理。
 *
 * 两个都不能省的细节，否则「干净检出上放行」这条规则会静默失效：
 *   * `--no-index`：没有它时 git 只检查工作区里真实存在的路径，
 *     而这里要判的恰恰是「还没构建 / 还没装依赖时不存在」的那些路径；
 *   * 补一次尾斜杠：`.gitignore` 里 `dist/` 这种模式只匹配目录，
 *     带 `--no-index` 时 git 又不看文件系统，所以 `apps/web/dist` 这种不带尾斜杠的写法匹配不上，
 *     而文档里写的正是这种写法。
 */
function isIgnored(target) {
  const check = (candidate) => {
    try {
      execFileSync('git', ['check-ignore', '-q', '--no-index', '--', candidate], {
        cwd: ROOT,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  };
  return check(target) || check(`${target.replace(/\/+$/, '')}/`);
}

function checkPath(doc, target) {
  // 带省略号或通配符的写法是示意，不是可点击的具体路径。
  if (target.includes('...') || target.includes('*')) {
    return;
  }
  if (existsSync(join(ROOT, target))) {
    return;
  }
  if (isIgnored(target)) {
    return;
  }
  failures.push(`${doc}: 提到不存在的路径 ${target}`);
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

/** 只在这类文档里裸写、不打算做成链接的 URL（本机地址、示例占位）。 */
const BARE_URL_ALLOWLIST = new Set(['localhost', '127.0.0.1', 'example.com']);

/**
 * 正文里的裸 URL：GitHub 只对规规矩矩的裸 URL 自动加链接，
 * 写成 `**https://…**` 就会渲染成一段点不动的死文本——README 的「线上地址」曾经就这么砸过。
 * 这条规则不让同一个坑再踩第二次。
 *
 * 先剥掉围栏代码块与行内代码（代码里的 URL 本来就不该是链接），
 * 再把已经是 Markdown 链接的整段抹白——目标与链接文字都要抹，
 * 因为 `[https://x](https://x)` 这种「用 URL 当链接文字」的写法是合法的、也点得动。
 */
function checkBareUrls(doc, raw) {
  const stripped = raw.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const masked = stripped.replace(/\[[^\]]*\]\(\s*<?https?:\/\/[^\s)>]*>?\s*\)/g, (all) => ' '.repeat(all.length));
  // 结尾不收 * _ ~ 这些强调符，否则 `**https://x**` 会把 `**` 吸进 URL 里、给出误导的建议。
  for (const match of masked.matchAll(/https?:\/\/[^\s)>\]，。；：、"'_*~]+/g)) {
    let host;
    try {
      host = new URL(match[0]).hostname;
    } catch {
      continue;
    }
    if (BARE_URL_ALLOWLIST.has(host)) {
      continue;
    }
    failures.push(
      `${doc}: 正文里的裸链接 ${match[0]} 在 GitHub 上不可点击，请写成 [文字](${match[0]})；` +
        `如果它只是示例而非链接，就用反引号包起来`,
    );
  }
}

const docs = collectDocs();
const scripts = collectScriptNames();

/** 文档里故意提到、但并非调用命令的写法（例如「不要用 `pnpm docs` 这个 script 名」）。 */
const COMMAND_MENTION_ALLOWLIST = new Set(['docs']);

/**
 * 扫描源码里真正被 import 的模块名（只认 import/export ... from 与 require，不认注释里的提及）。
 */
function importedModules(text) {
  const modules = [];
  for (const match of text.matchAll(/(?:^|\n)\s*import\s+(?:type\s+)?[^'"\n]*?from\s+['"]([^'"]+)['"]/g)) {
    modules.push(match[1]);
  }
  for (const match of text.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) {
    modules.push(match[1]);
  }
  for (const match of text.matchAll(/export\s+(?:type\s+)?[^'"\n]*?from\s+['"]([^'"]+)['"]/g)) {
    modules.push(match[1]);
  }
  return modules;
}

function collectSourceFiles(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) {
        continue;
      }
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry)) {
        files.push(full);
      }
    }
  };
  walk(join(ROOT, dir));
  return files;
}

/**
 * 平台边界：`packages/core/src` 不许 import 浏览器 API、框架、Node 内置模块，
 * 也不许跨包 import。这是 AGENTS.md 里那条硬约束的可执行版本。
 */
function checkCorePlatformBoundary() {
  const forbidden = [
    { pattern: /^react(-dom)?(\/|$)/, what: 'React' },
    { pattern: /^node:/, what: 'Node 内置模块' },
    { pattern: /^(fs|path|url|os|child_process|crypto)$/, what: 'Node 内置模块' },
    { pattern: /^@yuegan\//, what: '其他 workspace 包' },
  ];
  for (const file of collectSourceFiles('packages/core/src')) {
    const rel = file.slice(ROOT.length + 1);
    for (const moduleName of importedModules(readFileSync(file, 'utf8'))) {
      if (moduleName.startsWith('.')) {
        continue;
      }
      const hit = forbidden.find((entry) => entry.pattern.test(moduleName));
      if (hit !== undefined) {
        failures.push(`${rel} import 了 ${hit.what}「${moduleName}」，破坏了 packages/core 的平台无关性`);
      } else {
        failures.push(`${rel} import 了外部模块「${moduleName}」，packages/core 不允许有运行时依赖`);
      }
    }
    // 兜底：源码里出现浏览器全局对象也视为越界（注释里的说明不算）。
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    for (const global of ['document.', 'window.', 'localStorage', 'AudioContext']) {
      if (code.includes(global)) {
        failures.push(`${rel} 出现了浏览器 API「${global}」，破坏了 packages/core 的平台无关性`);
      }
    }
  }
}

/** 依赖方向：web 只能从包入口 import core，不能深入 core 的源码路径。 */
function checkPackageEntryImports() {
  for (const file of collectSourceFiles('apps/web/src')) {
    const rel = file.slice(ROOT.length + 1);
    for (const moduleName of importedModules(readFileSync(file, 'utf8'))) {
      if (moduleName.startsWith('@yuegan/core/')) {
        failures.push(`${rel} 从「${moduleName}」深层导入 core，请改走包入口 @yuegan/core`);
      }
    }
  }
}

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

  // 4. 正文里的裸 URL（在 GitHub 上点不动的那种写法）
  checkBareUrls(doc, raw);
}

checkCorePlatformBoundary();
checkPackageEntryImports();

if (failures.length > 0) {
  console.error('文档校验失败：');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`文档校验通过：${docs.length} 份文档，路径/命令/链接均有效；core 的平台边界与包入口依赖方向均成立。`);
