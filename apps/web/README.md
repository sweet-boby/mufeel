---
description: "把 @yuegan/core 的排序规则与移植来的课程装配成能跑的网页产品：React 界面 + 采样播放 + 中英双语 + 本地进度存档。"
kind: "package-library"
---

# @yuegan/web

## Summary

`@yuegan/web` 是产品装配层，不是库：没有别的包 import 它，它的产物是一个网页。它用 React 19.3.0 渲染七个模块的课程（音高 / 音程 / 和弦 / 音阶与调式 / 音级 / 和弦进行 / 旋律），用一套钢琴采样播放全部题型，用 localStorage 存技能项与关卡两级进度，并支持中英双语（默认中文）。课程结构、七种题型的思路与界面样式移植自 [abeage1/earpath-app](https://github.com/abeage1/earpath-app)（MIT）；本项目在它之上加了 **n 个音排序**练习（音高模块第 5–10 关）与双语。

音乐判断一条都不在这里：排序题的出题、正确答案与判分全部来自 `@yuegan/core`；这一层只做「音高 → 播放事件 / 音名」的翻译与渲染。课程层面的规则（一关要连对几题、技能项权重、每日混合题数）是产品概念，住在 `src/course/curriculum.ts` 与 `src/infrastructure/progress.ts`，core 里没有对应物。依赖方向是单向的——`apps/web` → `@yuegan/core`，core 不知道 web 存在。

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Use this package

日常开发与构建：

```sh
pnpm install
pnpm dev      # Vite 开发服务器，http://localhost:5173，不自动开浏览器
pnpm build    # 产出 apps/web/dist
pnpm preview  # 预览已构建的产物
pnpm test     # 跑 i18n 门禁（vitest）
```

要改的东西大多落在这几处：

| 想改什么 | 改哪里 |
|---|---|
| 课程：加模块、加关卡、调解锁 | `src/course/curriculum.ts`（文案用 i18n key，两份字典要同时补） |
| 加一种题型或改出题 | `src/questions/`（协议在 `types.ts`，派发在 `index.ts`） |
| 界面结构、交互、样式 | `src/presentation/`、`src/styles/global.css` |
| 播放方式、音色 | `src/infrastructure/audio/` |
| 进度存档、设置项 | `src/infrastructure/progress.ts` |
| 排序题的难度档或判分 | 属于 `packages/core`，见 [packages/core/README.md](../../packages/core/README.md) |

从 web 里 import core 一律走包入口 `@yuegan/core`；`pnpm test:docs` 会拦住深层导入。

-----

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### 目录与职责

| 文件 | 职责 |
|---|---|
| [`src/main.tsx`](src/main.tsx) | 读存档 → 挂载 React → 注册 Service Worker；找不到 `#root` 就抛错，而不是静默白屏 |
| [`src/app/App.tsx`](src/app/App.tsx) | hash 路由（`#/module/:id`、`#/practice/:id/:level`、`#/daily`、`#/stats`、`#/settings`、`#/guide`）与入门引导浮层 |
| [`src/course/curriculum.ts`](src/course/curriculum.ts) | 模块、关卡、解锁路径与每关练什么；Pitch 模块的排序关卡在这里把「音数 + 难度档」交给 core |
| [`src/i18n/domain-labels.ts`](src/i18n/domain-labels.ts) | 领域 id → 文案的映射（名字、参考曲目、方向）与音名/MIDI 换算；音乐事实本身在 core |
| [`src/questions/`](src/questions/) | 四种题型的生成器（`choice` / `sequence` / `melody` / `rank`）、题型协议、播放事件构造器；`rank.ts` 是排序题接 core 的适配层 |
| [`src/presentation/useSession.ts`](src/presentation/useSession.ts) | 练习会话状态机（reducer）：出题 → 播放 → 作答 → 判分 → 下一题，含重听上限、自动前进与结算浮层 |
| [`src/presentation/screens/`](src/presentation/screens/) | 首页、模块页、练习页（四种作答 UI）、统计页、设置页、指南页 |
| [`src/presentation/components/`](src/presentation/components/) | 顶栏、进度圆环、屏幕键盘、入门引导 |
| [`src/infrastructure/audio/piano-engine.ts`](src/infrastructure/audio/piano-engine.ts) | 全站唯一的发声通道：采样加载与事件调度（事件构造器在 [`questions/events.ts`](src/questions/events.ts)，它是纯数据，不碰 Web Audio） |
| [`src/infrastructure/audio/core-audio-player.ts`](src/infrastructure/audio/core-audio-player.ts) | 给 core 的 `AudioPlayer` 端口做的适配器：**排序题的播放走它**，其余题型直接给采样引擎事件（需要和弦与终止式） |
| [`src/infrastructure/progress.ts`](src/infrastructure/progress.ts) | 进度与设置：技能项/关卡两级统计、连击、每日活动、混淆统计、导入导出；对外只暴露一个版本号订阅 |
| [`src/i18n/`](src/i18n/) | 中英字典、翻译运行时与一致性门禁测试 |

### 排序题怎么接 core

[`src/questions/rank.ts`](src/questions/rank.ts) 只做翻译：调 core、把音高序列交给 core 的播放端口、把判分结果换成界面协议。

| core 提供 | 用在哪 |
|---|---|
| `createDrillSpecForTier(tier, noteCount)` | 关卡的「音数 + 难度档」→ 音域 + 跨度规则 + 重听上限 |
| `createExerciseGenerator(random)` | 出题：n 个互不相同的音，播放顺序打乱 |
| `correctRanks(exercise)` | 唯一正确答案（升序名次），只用于核对与调试 |
| `createRankOrderJudge()` | 判分：每个音的名次都对才算对，并给出逐音明细 |
| `assignRank` / `isDraftSubmittable` | 作答草稿：档位被占时的互换语义、能不能提交 |

界面上「哪一格已被别的音占用」是把 core 的草稿按列反查出来的（`useSession` 的 `takenRanks`），不是另写一套规则。

### 四种作答方式

| 题型 | 作答 UI | 判分要点 |
|---|---|---|
| `choice` | 选项按钮（比高低 / 音程 / 和弦 / 音阶 / 音级） | 选项 id 是否等于答案；答错时可从同一个根音重放「你选的」与「正确答案」 |
| `sequence` | 逐槽填级数（和弦进行），填满自动提交 | 逐槽对错，给定提示槽不计入技能项 |
| `melody` | 屏幕键盘（听写），弹满即提交 | 逐音对错，可「在键盘上显示」正确答案 |
| `rank` | n 列档位梯（每列一个音，数字越大 = 音越高） | core 的判分器；反馈逐音给出「你填 / 正确 / 真实音高 / 与上一个音差几个半音」 |

### 会话状态机

`useSession` 是一个 reducer：`question` / `playing` / `played` / `answered` 等动作驱动，所有作答草稿（`rankDraft`、`seqPick`、`melodyPick`）都在 reducer 里更新——**这一点是刻意的**：档位分配必须在最新草稿上计算，否则快速连点两格时第二次会拿渲染期的旧草稿做基准而互相覆盖。

几个关键时序：音频未就绪时先显示「点一下开始」（用户手势同时也满足浏览器对 AudioContext 的要求）；首题在采样加载完成后自动播放，且**不计入重听**；答对且开了自动前进时，1.1 秒后自己走——**排序题例外**：它的反馈（真实顺序 + 逐音「你填/正确/真实音高」）是这道题最该看的东西，永远停下来等用户点「下一题」，本关达成时也先把按钮换成「看结果」，点了才弹庆祝浮层；答完题还会把操作区滚进视野（排序题与旋律题的作答区很高，反馈一出现「下一题」就会被挤到首屏之外）；每日混合满 15 题弹小结。

### 进度模型

`progress.ts` 的状态是**可变对象**（答题热路径上不做深拷贝），对 React 只暴露一个自增的版本号（[`src/presentation/hooks.ts`](src/presentation/hooks.ts) 的 `useProgressVersion` → `useSyncExternalStore`），所以组件重渲染由「写过一次」驱动，而不是由对象标识变化驱动。技能项 key 形如 `iv:P5:a`（上行纯五度）或 `rk:standard:3`（中音区 3 音排序），出题权重按它的最近正确率计算——没见过和最近老错的更常出现。

### i18n

`src/i18n/` 里 `zh.ts` 是默认语言、`en.ts` 是英文，key 扁平（`module.pitch.level.order3.name` 这种）。
面向用户的名字有两条来源，都指向字典：课程表里的文案字段（`nameKey` / `hintKey`），
以及 `domain-labels.ts` 里「core 的内容 id → 文案 key」的映射（音程/和弦/音阶的名字、参考曲目、方向符号）。
`i18n.test.ts` 强制四件事：两份字典 key 完全一致、同一条文案的插值占位符一致、源码里 `t('...')` 用到的 key 都存在、
以及 core 内容表的 id 与这里的名字映射一一对应（多一条少一条都红）。测试用 `import.meta.glob` 读源码，因此不需要 node 类型。

### 为什么用采样而不是合成音

全部题型共用一个采样引擎（`piano-engine.ts`）：28 个 Salamander 采样覆盖 C1–A7，中间的音靠取最近采样变速补齐，映射规则在 core 的 `assignSample` 里（见 [ADR 0002](../../docs/adr/0002-native-web-audio-over-tonejs.md)）。加载时机是「用户点开始之后」，兜底定时器保证 `onended` 不触发时也不会把界面锁在「正在播放」。

</details>

-----

## Further Exploration

- [CONTEXT.md](../../CONTEXT.md) 与 [AGENTS.md](../../AGENTS.md)——术语的唯一定义处，以及这个仓库对 agent 的工作约定。
- [packages/core/README.md](../../packages/core/README.md)——领域核心的契约：出题与判分规则、必须成立的不变量。
- [ADR 0001](../../docs/adr/0001-domain-core-separated-from-platform.md)——为什么规则不在这个包里；[ADR 0002](../../docs/adr/0002-native-web-audio-over-tonejs.md)——为什么用原生 Web Audio；[ADR 0003](../../docs/adr/0003-earpath-curriculum-in-web.md)——课程壳为什么住在这一层、排序题与 core 的分工。

## Known Limitations and Deferred Work

- **测试只有 i18n 门禁**——`src/i18n/i18n.test.ts` 覆盖文案一致性；会话状态机、四种作答 UI、进度模型没有单元测试，靠浏览器里真的点一遍验证（`pnpm test` 里 web 侧只有这 6 个用例）。
- **core 的 `DrillRunner` 在 web 上没有装配点**——「一局固定题数」的形态如今只被 core 自己的测试覆盖（排序题只用到 core 的领域服务与 `AudioPlayer` 端口，不用它编排会话）；要重新启用它就要自己写 `DrillRecordRepository` 实现并接进某个页面。
- **改 core 后 Vite 的模块缓存可能不刷新**——HMR 有时不会重新加载 `packages/core`，浏览器里跑的还是旧逻辑，甚至整页空白；重启 `pnpm dev` 并删掉 `node_modules/.vite`。
- **进度只在本机**——存在 localStorage 的 `yuegan.progress.v1` 下，换设备或清空浏览器数据不会带走（设置页可导出 / 导入 JSON）。
- **采样是打包死的**——28 个 mp3 随仓库发布，换音色要同时改采样目录与 core 里的采样映射表，两边有测试核对。
- **首题前要等采样加载完**——没有按需加载或流式播放：点「开始」后 28 个文件全部 decode 完才出第一题（首次约 1.8 MB）。
- **音数上限固定**——排序题每题最多 5 个音（core 的 `MAX_NOTE_COUNT`），课程里也只排到 5 个。

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

- 只改界面时跑 `pnpm typecheck` 与 `pnpm build`，然后在浏览器里点一遍改动的那条路径；改了 `packages/core` 还要跑 `pnpm test`，改文档跑 `pnpm test:docs`，改文案跑 `pnpm test`（i18n 门禁）。
- 排查不要从 DOM 反推状态：`window.__yueganSession` 是当前练习会话（仅 DEV 构建暴露），`getState()` 给会话状态，`truth()` 给当前排序题的真实音高与正确答案（`{ pitches, correct }`）。
- 排序关卡是锁着的（要按顺序解锁）：验证时先在设置里打开「解锁全部关卡」，直接访问 `#/practice/pitch/4` 就是「三个音排序」。
- 这个包只从包入口 import core；`pnpm test:docs` 会检查深层导入与 core 的平台边界，也会检查文档里的路径、命令与相对链接。

</details>
