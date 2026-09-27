# 乐感练习（yuegan）

乐感练习（`yuegan`）是一个练耳网页应用：系统依次弹出 2～5 个钢琴音，用户为每个音拖动一个滑块，把这些音排成正确的相对高低顺序。

它练的是「听出若干音彼此的高低关系」，不要求听出这些音具体是哪些音。

## 运行

需要 Node >= 20.19.0 与 pnpm@11.7.0。

```sh
pnpm install
pnpm dev
```

`pnpm dev` 在 http://localhost:5173 启动 Vite（`server.port` 5173，不自动打开浏览器）。

首次进入练习会加载 `apps/web/public/samples/piano/` 下全部 28 个钢琴采样（约 1.8 MB），之后不再加载；采样随仓库打包，运行时不访问外网。

## 仓库结构

```text
packages/core/               平台无关的领域核心（@yuegan/core）：20 个 .ts 源文件，纯 TypeScript
  src/domain/value-objects/  音高、音名、音程、档位、稀疏采样映射
  src/domain/entities/       题目、作答、判分结果、练习规格、一局练习
  src/domain/services/       出题器与判分器：全部出题与判分规则
  src/domain/ports/          音频播放、练习记录仓储、随机源（只有接口）
  src/domain/config.ts       播放参数与默认音域
  src/application/           用例编排与 view state
  src/index.ts               包的公开导出
  tests/                     4 个测试文件、51 个用例
apps/web/                    浏览器端（@yuegan/web）：React 界面 + 原生 Web Audio
  src/infrastructure/        采样加载、Web Audio 播放器、localStorage 仓储
  src/presentation/          首页 / 练习页 / 结果页与 React 接线
  src/main.tsx               挂载入口
  src/styles/global.css      全局样式
  public/samples/piano/      28 个 Salamander 钢琴采样
docs/adr/                    架构决策记录：0001 领域核心与平台分离、0002 原生 Web Audio
CONTEXT.md                   领域术语的唯一定义处
AGENTS.md                    面向 agent 的工作约定
```

仓库用 pnpm 管理，workspace 只有 `packages/core` 与 `apps/web` 两个包；根包 `yuegan` 是 private 的，只放脚本与 `tsconfig.base.json`。

`packages/core` 里不出现任何浏览器 API：播放、存储、随机数一律通过 `packages/core/src/domain/ports/` 的接口注入，界面不推算业务规则，只渲染 `packages/core/src/application/view-model.ts` 产出的 view state。这条边界的判据与代价见 [ADR 0001](docs/adr/0001-domain-core-separated-from-platform.md)。

## 命令

| 命令 | 展开后 | 作用 |
| --- | --- | --- |
| `pnpm dev` | `pnpm --filter @yuegan/web run dev` | 启动 Vite 开发服务器 |
| `pnpm build` | `pnpm --filter @yuegan/web run build` | Vite 构建，输出到 apps/web/dist |
| `pnpm preview` | `pnpm --filter @yuegan/web run preview` | 预览已构建的产物 |
| `pnpm typecheck` | `pnpm -r run typecheck` | 两个包各跑 `tsc -p tsconfig.json` |
| `pnpm test` | `pnpm -r run test` | 两个包各跑 `vitest run`，`@yuegan/web` 带 `--passWithNoTests` |
| `pnpm test:docs` | `node scripts/verify-docs.mjs` | 文档门禁：文档里的路径、`pnpm` 命令与相对链接必须有效 |

实测：`pnpm test` 在 `packages/core` 的 4 个测试文件里通过 51 个用例，`apps/web` 没有测试文件；`pnpm typecheck` 两个包都通过；`pnpm build` 产出约 2.7 MB（`du` 磁盘占用），其中 28 个采样文件本身 1.8 MB，JS 主包 245 KB（gzip 76 KB）、CSS 8.2 KB（gzip 2.5 KB）。

## 文档地图

每份文档只负责一类事实，改东西时先看对应那一份：

| 想找什么 | 读哪里 |
| --- | --- |
| 怎么跑、命令、目录结构 | 本文件 |
| 某个词在本项目里到底指什么（题目 / 档位 / 作答 / 跨度……） | [CONTEXT.md](CONTEXT.md) |
| 为什么这样分层、为什么不用 Tone.js | [docs/adr/](docs/adr/0001-domain-core-separated-from-platform.md) |
| 想加功能：有哪些扩展点、各自要不要动领域模型 | [docs/extension-cookbook.md](docs/extension-cookbook.md) |
| 按步骤加一个难度档（含验证） | [docs/cookbook/adding-a-difficulty-tier.md](docs/cookbook/adding-a-difficulty-tier.md) |
| 领域核心的契约、不变量与已知边界 | [packages/core/README.md](packages/core/README.md) |
| 界面与平台适配器的组织方式 | [apps/web/README.md](apps/web/README.md) |
| 面向 agent 的工作约定与验证要求 | [AGENTS.md](AGENTS.md) |

`pnpm test:docs` 校验这些文档里的路径、`pnpm` 命令与相对链接是否仍然有效。

## 能力与边界

每题弹 2～5 个音，音高在所选难度档的音域内随机且互不相同，播放顺序打乱；每题给出与音数相同的滑块与档位，把每个滑块放到它该在的位置，数字越大 = 音越高，全部放对才算这题答对。

三档难度：`中音区`（C3–C5，跨度不限）、`全音域`（C1–A7，跨度不限）、`八度内`（C3–C5，整题跨度 ≤ 12 个半音）。`全音域`档把音均匀撒在 C1–A7 这 82 个音高里，题内音因此隔得远：2～5 个音的中位跨度 24～57 个半音，`中音区`档同一口径只有 7～18 个。一局 10 题，规格在开始前选定，一局之内不变。

每题最多主动重听 3 次，首次自动播放不算重听。提交后立即给出对错与逐音对照（你填第几位 / 正确第几位 / 真实音高），并重放这道题的真实音频；结算页给出正确率与逐题明细。

成绩存在 localStorage 的 `yuegan.drill-records.v1` 键下，最多保留 200 局。

尚未实现绝对音高识别、参考音、音程判断、单音重播（重听只能重放整题）、账号 / 排行 / 跨设备同步（记录只在浏览器本地）；练习只判断相对位置。这些术语的定义见 [CONTEXT.md](CONTEXT.md)，包级的不变量与已知约束见 [packages/core/README.md](packages/core/README.md)。

## 扩展点

| 想做的事 | 改哪里 |
| --- | --- |
| 加难度档（音域 + 跨度规则一起定义） | `packages/core/src/domain/entities/drill-spec.ts` 的 `DIFFICULTY_TIERS` 与 `DIFFICULTY_TIER_ORDER`，首页按钮自动出现；要新的跨度/音程约束才动 `packages/core/src/domain/services/exercise-generator.ts` |
| 改判分口径（音程、音级、部分得分） | 另写一个 `Judge` 实现，替换 `packages/core/src/domain/services/judge.ts` 的注入 |
| 换音色或换播放方式 | 实现 `packages/core/src/domain/ports/audio-player.ts` 的 `AudioPlayer` 端口（现有实现见 `apps/web/src/infrastructure/web-audio-piano-player.ts`） |
| 换记录存储（账号、服务端） | 实现 `packages/core/src/domain/ports/drill-record-repository.ts` 的 `DrillRecordRepository` 端口 |
| 改界面或加页面 | `apps/web/src/presentation/`；业务状态一律取自 core 的 view state，界面里不推算规则 |
| 把领域核心用到别的平台 | 原样复用 `packages/core`，另写 `AudioPlayer` 适配器与界面 |

## 开发

工具链：TypeScript 7.0.2、Vite 8.3.1、Vitest 5.0.2、React 19.3.0、@vitejs/plugin-react 6.1.1、@types/node 24.x。没有 lint 脚本，也没有 Prettier / ESLint 配置。

`tsconfig.base.json` 开 strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes、noImplicitOverride、noFallthroughCasesInSwitch、noUnusedLocals、noUnusedParameters、isolatedModules、verbatimModuleSyntax、noEmit，target ES2022、module ESNext、moduleResolution bundler；`packages/core` 额外 `types: ["node"]`（测试要读文件系统），`apps/web` 加 DOM lib、`jsx: react-jsx`、`types: ["vite/client"]`。

播放参数集中在 `packages/core/src/domain/config.ts`：每音 1200 ms、音间停 400 ms，播放器不写死节奏。

钢琴采样每 3 个半音一个（C / D# / F# / A），覆盖 C1–A7（音高 -36…45，以 C4 = 0 计），中间的音取最近的采样变速变调补齐，最多 2 个半音；练习用到的 C3–C5 与 C1–A7 内都不超过 1 个半音。采样映射是 core 里的纯逻辑，播放器只负责执行，理由见 [ADR 0002](docs/adr/0002-native-web-audio-over-tonejs.md)。

开发期后门：浏览器控制台里 `window.__yueganRunner` 是当前的 `DrillRunner`（仅 DEV 构建暴露），`getState().forge` 是整局题库的真实音高与正确答案快照。

已知环境坑：改 `packages/core` 的源码时 Vite 的 HMR 有时不会重新加载该模块，浏览器里跑的仍是旧逻辑，此时重启 `pnpm dev` 并删除 `node_modules/.vite` 缓存；pnpm 在这台机器上把 store 建在仓库内的 `.pnpm-store/`（已 gitignore）。

术语以 [CONTEXT.md](CONTEXT.md) 为准，架构决定见 [docs/adr/](docs/adr/0001-domain-core-separated-from-platform.md)，工作约定见 [AGENTS.md](AGENTS.md)。
