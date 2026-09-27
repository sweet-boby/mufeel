# AGENTS.md

乐感练习（yuegan）是一个练耳网页应用：系统依次弹出 2～5 个钢琴音，用户在 n 个滑块上把每个音排到正确的相对位置。领域核心与平台实现分离，以后要出安卓端时复用 `packages/core`。

先读 [CONTEXT.md](CONTEXT.md)（术语的唯一定义处）与 [docs/adr/](docs/adr/0001-domain-core-separated-from-platform.md)（架构决定）；命令与目录见 [README.md](README.md)。

## 平台的边界（这是本项目唯一的硬约束）

- **`packages/core` 不许出现任何浏览器 API**：DOM、Web Audio、React、`localStorage`、`fetch` 都不行。判断标准是客观的——`packages/core/src` 里出现一个就说明边界破了。平台能力一律通过 `domain/ports` 的接口注入。
- 界面不许自己推算业务规则。哪个档位被占用、能不能提交、还能听几次、正确与否，全部来自 `application/view-model.ts` 产出的 view state。
- 贫血模型：领域对象是纯数据类型（`interface`），没有方法；规则以纯函数形式住在 `domain/services` 与 `domain/entities`（理由见 [ADR 0001](docs/adr/0001-domain-core-separated-from-platform.md)）。新规则请加到这两处，不要写进 React 组件或播放器。

## 包与依赖方向

| 包 | 是什么 | 可以依赖 |
| --- | --- | --- |
| `packages/core`（`@yuegan/core`） | 平台无关的领域核心，唯一入口是 `src/index.ts` | 无运行时依赖；连 Node 内置模块都不许 import（`node:fs` 只出现在测试里，用于核对采样文件） |
| `apps/web`（`@yuegan/web`） | 产品装配层：界面 + 平台适配器 | `@yuegan/core`、`react`、`react-dom` |

依赖是单向的：`apps/web` → `@yuegan/core`，core 不知道 web 存在。从 web 里 import core 一律走包入口 `@yuegan/core`，不要深入 core 的源码文件——那条路径绕过公开导出，一旦内部改名就会静默失效。各自的契约见 [packages/core/README.md](packages/core/README.md) 与 apps/web/README.md。

## 出题与判分的规则住在哪

- 出题规则只有一处：`packages/core/src/domain/services/exercise-generator.ts`。判分规则只有一处：`packages/core/src/domain/services/judge.ts`。改规则改这两个文件，不要在别处复制一份。
- 一条题目的正确答案由音高唯一确定（升序名次）。不要另写一套推导——`view state` 的 `forge` 快照与 `correctRanks()` 是唯一来源。
- 档位数 == 本题音数。一个档位最多被一个滑块占用，`assignRank` 会断言这一点。这两个不变量是"答案唯一、用户可表达"的基础，改动它们等于改产品。

## 改动时的规矩

- 改行为就同时改它的说明书：受影响的是 [CONTEXT.md](CONTEXT.md)（术语含义变了）、`docs/adr/`（做了一个难以回退的取舍）、以及源码里的 JSDoc。文档与代码不一致时，以代码为准并立刻修文档。
- 新增术语先查 CONTEXT.md。同一个概念出现第二个说法时，改回正名，而不是让两种说法并存。
- 规则变化必须带测试。`packages/core` 的测试是行为测试（出题不变量、判分口径、流程与状态不变量），不是实现快照——改规则时改对应的行为断言，并说明为什么。
- 出题这类"随机但必须满足性质"的逻辑，用穷举式性质测试（现有做法是 200 局 × 每局 10 题），不要只用固定随机源的单个用例。
- 播放器与仓储这类平台实现，测试里用桩替换（`tests/drill-runner.test.ts` 里的 `FakeAudioPlayer` 与确定性 LCG 随机源是模板）。

## 验证

```sh
pnpm typecheck   # 两个包的 tsc，必须干净
pnpm test        # 领域核心的行为测试
pnpm build       # 产出 apps/web/dist
pnpm test:docs   # 文档门禁：路径、命令、链接是否仍然有效
pnpm dev         # http://localhost:5173
```

- 改 `packages/core` 之后至少跑 `pnpm test`；改界面之后必须在浏览器里真的点一遍那条路径。
- 改文档之后跑 `pnpm test:docs`：它会抓出重命名文件后忘改的路径、写错的 `pnpm` 命令、失效的相对链接。新增文档不需要登记，脚本自己会扫。
- 命名注意：不要用 `pnpm docs` 这个 script 名，它会和 pnpm 自带的 `docs` 命令撞名而报 `ERR_PNPM_MISSING_PACKAGE_NAME`。
- **已知环境坑**：修改 `packages/core` 的源码时 Vite 的 HMR 有时不会重新加载该模块，浏览器里跑的还是旧逻辑（表现为"代码明明改了、界面没变"）。此时重启 `pnpm dev` 并删除 `node_modules/.vite`，再验证一次。
- 浏览器里排查时不要从 DOM 反推状态：`window.__yueganRunner` 就是当前的 `DrillRunner`（仅开发构建暴露），`window.__yueganRunner.getState()` 给出真实领域状态，其中的 `forge` 给出整局题库的真实音高与正确答案。答对/答错这类判断以它为准。
- pnpm 在这台机器上把依赖 store 建在仓库内（`.pnpm-store/`，已 gitignore）。若发现它被 `git add` 进来，先确认 `.gitignore` 没被改坏。

## 别做的事

- 不要在 `packages/core` 里为了图快 import 平台能力，也不要为"以后可能需要"预先抽象——扩展点已经有明确位置（端口 / 判分器 / 练习规格）。
- 不要把难度控制塞进界面：一档难度的音域与跨度规则写在 core 的难度档表（`DIFFICULTY_TIERS` / `DIFFICULTY_TIER_ORDER`）里，界面只按表渲染；加一档只改 core。规矩见 [docs/cookbook/adding-a-difficulty-tier.md](docs/cookbook/adding-a-difficulty-tier.md)。
- 不要在答题过程中显示音高或音名，也不要在滑块上标音名刻度：那会让用户用读刻度代替听。真实音高只在反馈阶段出现。
- 不要提交 `apps/web/dist/`、`node_modules/` 或 `.pnpm-store/`。
