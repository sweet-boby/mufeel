---
description: "把 @yuegan/core 的领域规则装配成能跑的网页产品：React 界面 + 原生 Web Audio 播放 + localStorage 记录，界面只渲染 core 产出的 view state。"
kind: "package-library"
---

# @yuegan/web

## Summary

`@yuegan/web` 是产品装配层，不是库：没有别的包 import 它，它的产物是一个网页。它用 React 19.3.0 渲染三个页面（首页选规格、练习页听音与上下拖滑块、结果页看正确率与逐题明细），用原生 Web Audio 播放钢琴采样，用 localStorage 存练习记录。领域规则一条都不在这里：出题、判分、状态流转全在 `@yuegan/core`，界面只渲染 view state，并把用户操作翻译成 runner 命令。依赖方向是单向的——`apps/web` → `@yuegan/core`，core 不知道 web 存在。core 的三个端口里 web 实现了两个（`AudioPlayer`、`DrillRecordRepository`），随机源用 core 的默认实现。这个包没有测试文件（`vitest run --passWithNoTests`），行为测试全部在 core，界面改动靠浏览器里真的点一遍来验证。

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
```

`pnpm build` 的产物实测约 2.7 MB（`du` 磁盘占用）：JS 主包 246 KB（gzip 后 78 KB）、CSS 9.8 KB（gzip 后 2.9 KB），28 个采样本身 1.8 MB。

要改的东西大多落在这几处：

| 想改什么 | 改哪里 |
|---|---|
| 页面结构、交互、样式 | `apps/web/src/presentation/` 与 `apps/web/src/styles/global.css` |
| 播放方式、音色、记录存储 | `apps/web/src/infrastructure/` |
| 音数与难度选项 | 音数由 core 的 `MIN_NOTE_COUNT` / `MAX_NOTE_COUNT` 生成；难度按钮按 core 的 `DIFFICULTY_TIER_ORDER` 渲染，文案与提示取自 `DIFFICULTY_TIERS`——加一档只改 core，这个包不动 |

从 web 里 import core 一律走包入口 `@yuegan/core`，不要深入 `packages/core/src/` 下的某个文件：那条路径绕过公开导出，core 内部改名后不会报错，只会静默失效。`pnpm test:docs` 会拦住深层导入。

-----

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### 目录与职责

| 文件 | 职责 |
|---|---|
| [`src/main.tsx`](src/main.tsx) | 挂载 `App`；找不到 `#root` 就抛错，而不是静默白屏 |
| [`src/presentation/app.tsx`](src/presentation/app.tsx) | 页面切换（首页 / 练习页 / 结果页）与会话生命周期；`phase === 'finished'` 且有 summary 时显示结果页 |
| [`src/presentation/home-screen.tsx`](src/presentation/home-screen.tsx) | 选音数与难度。音数选项由 core 的 `MIN_NOTE_COUNT` / `MAX_NOTE_COUNT` 生成，难度按钮与提示全部取自 core 的难度档表（`DIFFICULTY_TIER_ORDER` / `DIFFICULTY_TIERS`） |
| [`src/presentation/drill-screen.tsx`](src/presentation/drill-screen.tsx) | 播放/重听、竖向并排的滑块、提交、反馈；每个滑块的档位选项、是否被占用、能否提交都来自 view state |
| [`src/presentation/result-screen.tsx`](src/presentation/result-screen.tsx) | 正确率与逐题明细 |
| [`src/presentation/use-drill.ts`](src/presentation/use-drill.ts) | React 与 `DrillRunner` 之间唯一的接缝（见下） |
| [`src/infrastructure/web-audio-piano-player.ts`](src/infrastructure/web-audio-piano-player.ts) | `AudioPlayer` 的 Web Audio 实现 |
| [`src/infrastructure/piano-samples.ts`](src/infrastructure/piano-samples.ts) | fetch + `decodeAudioData`，把 `AudioBuffer` 存起来 |
| [`src/infrastructure/local-storage-drill-record-repository.ts`](src/infrastructure/local-storage-drill-record-repository.ts) | `DrillRecordRepository` 的 localStorage 实现 |
| [`vite.config.ts`](vite.config.ts) | 把 `@yuegan/core` 别名指向 `packages/core/src/index.ts`，开发时直接吃 core 源码 |

### 两个端口实现

| 端口（定义在 core） | 实现 | 契约 |
|---|---|---|
| [`AudioPlayer`](../../packages/core/src/domain/ports/audio-player.ts) | `web-audio-piano-player.ts` | `load` 首次并发加载全部采样并缓存；`playSequence` 按 core 给的时序调度并在整串播完后 resolve；`stop` 立刻停掉正在发声的采样 |
| [`DrillRecordRepository`](../../packages/core/src/domain/ports/drill-record-repository.ts) | `local-storage-drill-record-repository.ts` | 键 `yuegan.drill-records.v1`，最多 200 局；读失败（存储被禁用、数据损坏）时返回空列表，不影响练习本身 |
| [`RandomSource`](../../packages/core/src/domain/ports/random-source.ts) | 不实现 | `DrillRunner` 默认用 core 的 `createMathRandomSource()` |

### React 与 DrillRunner 的接缝

[`use-drill.ts`](src/presentation/use-drill.ts) 订阅 runner：`subscribe()` 把每次状态变化推成 React state，用户操作翻译成 runner 命令（`start` / `play` / `proposeRank` / `selectRank` / `submit` / `next` / `reset`）。home-screen 的选择只带 `noteCount` 与 `tier`（`DrillSpecChoice`），由 `createSpecFromChoice` 走 `createDrillSpecForTier` 变成 `DrillSpec`（音域与跨度规则由难度档决定）。`quit()` 必须连同 `reset()` 一起调用：只切页面不重置 runner，会留下一局「进行中」的残留状态，首页再换规格会被 domain 拒绝。`import.meta.env.DEV` 为真时才把 runner 挂到 `window.__yueganRunner`，供浏览器控制台与自动化读真实领域状态。

### 采样与播放

[`public/samples/piano/`](public/samples/piano/) 下是 28 个 Salamander 钢琴采样（约 1.8 MB），每 3 个半音一个（C / D# / F# / A），覆盖 C1–A7。首次进入练习时 `Promise.all` 并发 fetch + decode 全部 28 个，之后一直复用，运行时不访问外网。每个音该用哪个采样、变调几个半音由 core 的 [`assignSample`](../../packages/core/src/domain/value-objects/sample-map.ts) 决定，播放器只执行：取 buffer、设 `playbackRate`、按 core 给的音长与音间留白调度、结尾加短淡出、`onended` 之外再挂一个兜底定时器，避免后台标签页里卡在「正在播放」。变调幅度上限由 core 的 `maxDetuneSemitones()` 给出（2 个半音），练习默认音域 C3–C5 内在 1 个半音以内。不用 Tone.js 的理由见 [ADR 0002](../../docs/adr/0002-native-web-audio-over-tonejs.md)。

### 界面不推算业务规则

能不能提交、哪个档位已被别的滑块占用、还能重听几次、这一题对不对、真实音高是什么，全部来自 `buildDrillViewState` 产出的 view state；答题过程中界面不显示音高与音名，真实音高只在反馈阶段出现（见 [ADR 0001](../../docs/adr/0001-domain-core-separated-from-platform.md) 与 [packages/core/README.md](../../packages/core/README.md)）。

### 滑块为什么是竖向并排的

一个音一列，列从左到右就是播放顺序，列内往上拖 = 档位数字变大 = 音更高：「越高越靠上」与听感方向一致，几根轨道凑在一起也比横排时好比高低，5 个音还比原来矮一半。滑块仍是原生 `input[type=range]`，用 CSS 的 `writing-mode: vertical-lr` + `direction: rtl` 竖过来（不用 `transform: rotate`：旋转出来的控件，指针命中区域与键盘焦点都得跟着转，竖向模式由浏览器自己算）。刻度列用 `column-reverse` 把 n 放在最上，上下各留「滑块头半径 − 半个刻度行高」，让首尾刻度正对滑块头停在两端时的圆心。判完分后轨道收短（`.slider-card.is-revealed`），好让「答对了/答错了」与「下一题」留在同一屏，不用为了继续而滚动。拖动、点击轨道与方向键都走同一对命令（`proposeRank` + `selectRank`），上/右为 +1、下/左为 −1。

</details>

-----

## Further Exploration

- [CONTEXT.md](../../CONTEXT.md) 与 [AGENTS.md](../../AGENTS.md)——术语的唯一定义处，以及这个仓库对 agent 的工作约定。
- [packages/core/README.md](../../packages/core/README.md)——领域核心的契约：view state 字段、出题与判分规则、必须成立的不变量。
- [ADR 0001](../../docs/adr/0001-domain-core-separated-from-platform.md)——为什么规则不在这个包里；[ADR 0002](../../docs/adr/0002-native-web-audio-over-tonejs.md)——为什么用原生 Web Audio。

## Known Limitations and Deferred Work

- **没有测试文件**——`apps/web/package.json` 的 test script 是 `vitest run --passWithNoTests`；播放器与仓储这两个实现没有自己的测试，core 的 `tests/drill-runner.test.ts` 只覆盖用桩替换端口时的编排，web 侧实现靠浏览器里手测。
- **改 core 后 Vite 的模块缓存可能不刷新**——HMR 有时不会重新加载 `packages/core`，浏览器里跑的还是旧逻辑（表现为「代码改了、界面没变」）；重启 `pnpm dev` 并删掉 `node_modules/.vite`。
- **记录只在本机**——成绩存在 localStorage 的 `yuegan.drill-records.v1` 下，最多 200 局；换设备或清空浏览器数据不会带走。
- **采样是打包死的**——28 个 mp3 随仓库发布，换音色要同时改采样目录与 core 里的采样映射表，两边有测试核对。
- **进练习前要等全部采样加载完**——没有按需加载或流式播放：28 个文件全部 decode 完才出第一题（首次约 1.8 MB）。
- **滑块数量上限固定**——每题最多 5 个音（core 的 `MAX_NOTE_COUNT`），界面不提供更多档位。

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

- 只改界面时跑 `pnpm typecheck` 与 `pnpm build`，然后在浏览器里点一遍改动的那条路径；改了 `packages/core` 还要跑 `pnpm test`，改文档跑 `pnpm test:docs`。
- 排查不要从 DOM 反推状态：`window.__yueganRunner.getState()` 给出真实领域状态，其中的 `forge` 是整局题库的真实音高与正确答案（仅 DEV 构建暴露）。
- 这个包只从包入口 import core；`pnpm test:docs` 会检查深层导入与 core 的平台边界，也会检查文档里的路径、命令与相对链接。

</details>
