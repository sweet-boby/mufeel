# AGENTS.md

乐感练习（yuegan）是一个练耳网页应用：从「两个音谁更高」到「把一串音排成正确的相对高低」，
另有音程、和弦、音阶与调式、音级、和弦进行、旋律听写六个模块。界面与课程移植自
[abeage1/earpath-app](https://github.com/abeage1/earpath-app)（MIT），全站中英双语、默认中文。
领域核心与平台实现分离，以后要出安卓端时复用 `packages/core`。

先读 [CONTEXT.md](CONTEXT.md)（术语的唯一定义处）与 [docs/adr/](docs/adr/0001-domain-core-separated-from-platform.md)
（架构决定：0001 领域核心分离、0002 原生 Web Audio、0003 课程壳与排序题的分工）；命令与目录见 [README.md](README.md)。

## 平台的边界（这是本项目唯一的硬约束）

- **`packages/core` 不许出现任何浏览器 API**：DOM、Web Audio、React、`localStorage`、`fetch` 都不行。
  判断标准是客观的——`packages/core/src` 里出现一个就说明边界破了。平台能力一律通过 `domain/ports` 的接口注入。
  `pnpm test:docs` 会机械校验这一条（含导入与全局对象两种形态）。
- **排序题的规则只有一份**：出题在 `packages/core/src/domain/services/exercise-generator.ts`，
  判分在 `packages/core/src/domain/services/judge.ts`。Web 端只调用它们，不复制第二份。
  `apps/web/src/domain/questions/rank.ts` 是适配层，只做「音高 → 播放事件 / 音名」的翻译，不做音乐判断。
- **界面不许自己推算业务规则。** 哪些档位被占用（`assignRank`）、能不能提交（`isDraftSubmittable`）、
  这一题对不对（`createRankOrderJudge`）、正确排序是什么（`correctRanks`）全部来自 core。
  课程层面的规则（一关要连对几题、技能项权重、每日混合多少题）属于产品，住在
  `apps/web/src/domain/curriculum.ts` 与 `apps/web/src/infrastructure/progress.ts`——这两类问题不要互相串门。
- **界面文案一律走 `t()`。** 组件与生成器里不许出现硬编码的中文或英文句子；
  `apps/web/src/i18n/zh.ts` 与 `en.ts` 的 key 必须完全一致，源码里用到的 key 必须存在，
  这两条由 `apps/web/src/i18n/i18n.test.ts` 强制（`pnpm test` 会跑）。
- 贫血模型：领域对象是纯数据类型（`interface`），没有方法；规则以纯函数形式住在 `domain/services` 与 `domain/entities`
  （理由见 [ADR 0001](docs/adr/0001-domain-core-separated-from-platform.md)）。新规则请加到这两处，
  不要写进 React 组件或播放器。

## 包与依赖方向

| 包 | 是什么 | 可以依赖 |
| --- | --- | --- |
| `packages/core`（`@yuegan/core`） | 平台无关的领域核心，唯一入口是 `src/index.ts` | 无运行时依赖；连 Node 内置模块都不许 import（`node:fs` 只出现在测试里，用于核对采样文件） |
| `apps/web`（`@yuegan/web`） | 产品装配层：课程 + 界面 + 平台适配器 | `@yuegan/core`、`react`、`react-dom` |

依赖是单向的：`apps/web` → `@yuegan/core`，core 不知道 web 存在。从 web 里 import core 一律走包入口
`@yuegan/core`，不要深入 core 的源码文件——那条路径绕过公开导出，一旦内部改名就会静默失效（`pnpm test:docs` 会拦）。
各自的契约见 [packages/core/README.md](packages/core/README.md) 与 [apps/web/README.md](apps/web/README.md)。

## 代码住在哪

- **课程的形状**：`apps/web/src/domain/curriculum.ts`（模块、关卡、解锁路径、每关练什么）。
- **题怎么出**：`apps/web/src/domain/questions/`。四个题型（`choice` / `sequence` / `melody` / `rank`）的协议在
  `types.ts`，按模块派发在 `index.ts`；`rank.ts` 是排序题接 core 的适配层。
- **练习怎么推进**：`apps/web/src/presentation/useSession.ts`（reducer 状态机：出题 → 播放 → 作答 → 判分 → 下一题）。
- **界面**：`apps/web/src/presentation/screens/`、`apps/web/src/presentation/components/`；页面路由在 `apps/web/src/app/App.tsx`。
- **乐理数据**：`apps/web/src/domain/theory.ts`（音程/和弦/音阶/音级的半音结构，名字存成 i18n key）。
- **播放**：`apps/web/src/infrastructure/audio/piano-engine.ts`（全站唯一的发声通道）与 `events.ts`（事件构造器）。
- **进度与设置**：`apps/web/src/infrastructure/progress.ts`（localStorage 键 `yuegan.progress.v1`）。

## 改动时的规矩

- 改行为就同时改它的说明书：受影响的是 [CONTEXT.md](CONTEXT.md)（术语含义变了）、`docs/adr/`（做了一个难以回退的取舍）、
  以及源码里的 JSDoc。文档与代码不一致时，以代码为准并立刻修文档。
- 新增术语先查 CONTEXT.md。同一个概念出现第二个说法时，改回正名，而不是让两种说法并存。
- 规则变化必须带测试。`packages/core` 的测试是行为测试（出题不变量、判分口径、流程与状态不变量），
  不是实现快照——改规则时改对应的行为断言，并说明为什么。加一门语言、改 i18n key 之后必须跑 `pnpm test`。
- 出题这类「随机但必须满足性质」的逻辑，用穷举式性质测试（现有做法是 200 局 × 每局 10 题），不要只用固定随机源的单个用例。
- 播放器与仓储这类平台实现，测试里用桩替换（`packages/core/tests/drill-runner.test.ts` 里的 `FakeAudioPlayer`
  与确定性 LCG 随机源是模板）。
- 移植过来的文件保留出处注释（样式表、课程与界面的顶部注释里都写了来源与许可），不要删。

## 验证

```sh
pnpm typecheck   # 两个包的 tsc，必须干净
pnpm test        # core 的行为测试 + web 的 i18n 门禁
pnpm build       # 产出 apps/web/dist
pnpm test:docs   # 文档门禁：路径、命令、链接、core 的平台边界
pnpm dev         # http://localhost:5173
```

- 改 `packages/core` 之后至少跑 `pnpm test`；改界面之后必须在浏览器里真的点一遍那条路径。
- 改文档之后跑 `pnpm test:docs`：它会抓出重命名文件后忘改的路径、写错的 `pnpm` 命令、失效的相对链接。
  新增文档不需要登记，脚本自己会扫。
- 命名注意：不要用 `pnpm docs` 这个 script 名，它会和 pnpm 自带的 `docs` 命令撞名而报 `ERR_PNPM_MISSING_PACKAGE_NAME`。
- **已知环境坑**：修改 `packages/core` 的源码时 Vite 的 HMR 有时不会重新加载该模块，浏览器里跑的还是旧逻辑
  （表现为「代码明明改了、界面没变」，也可能整页空白）。此时重启 `pnpm dev` 并删除 `node_modules/.vite`，再验证一次。
- 浏览器里排查时不要从 DOM 反推状态：`window.__yueganSession` 就是当前练习会话（仅开发构建暴露），
  `getState()` 给出会话状态，`truth()` 给出当前排序题的真实音高与正确答案（`{ pitches, correct }`）。
  答对/答错这类判断以它为准。

## 别做的事

- 不要在 `packages/core` 里为了图快 import 平台能力，也不要为"以后可能需要"预先抽象——扩展点已经有明确位置
  （端口 / 判分器 / 练习规格）。
- **不要把课程表塞进 core**：模块、关卡、解锁、关卡完成口径都是产品概念（理由见 ADR 0003）。
- **不要在界面或生成器里写死中英文文案**，也不要只改一份字典：`pnpm test` 的 i18n 门禁会红。
- **不要在答题过程中显示音高或音名**，也不要在排序题的列上标音名刻度：那会让用户用读刻度代替听。
  真实音高只在反馈阶段出现。
- 不要提交 `apps/web/dist/`、`node_modules/` 或 `.pnpm-store/`。
