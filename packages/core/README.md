---
description: "按练习规格出题、判档位作答、编排一整局练耳练习，并给出界面可直接渲染的状态；不引用任何浏览器 API。"
kind: "package-library"
---

# @yuegan/core

## Summary

`@yuegan/core` 做三件事：按练习规格出题（每题 2–5 个音、互不相同、落在音域内、播放顺序打乱、正确答案由音高唯一确定）、把档位作答判成对错、用 `DrillRunner` 编排一整局（加载音频 → 出题 → 播放 → 作答 → 判分 → 下一题 → 结算 → 存档）。它同时是界面唯一的业务真相来源：哪个档位被占用、能不能提交、还能重听几次、真实音高是什么，全部来自 `getState()` 返回的 view state。代价是接线：音频播放与练习记录要由平台实现 `AudioPlayer`、`DrillRecordRepository` 后注入（随机源默认是 `createMathRandomSource()`）；包内是纯 TypeScript，没有 DOM、Web Audio、React 或任何浏览器 API，同一份代码能跑在 Node、浏览器与以后的安卓端。

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Use this package

### 跑一局练习

```ts
import {
  createDrillSpec, DEFAULT_PLAYBACK, DrillRunner,
  type AudioPlayer, type DrillRecord, type DrillViewState,
} from '@yuegan/core'

declare const audioPlayer: AudioPlayer
declare function saveRecord(record: DrillRecord): Promise<void>
declare function render(state: DrillViewState): void

const runner = new DrillRunner(createDrillSpec({ noteCount: 3, spanPattern: 'within-octave' }), {
  audioPlayer, audioTiming: DEFAULT_PLAYBACK, recordRepository: { save: saveRecord },
})
runner.subscribe((event) => render(event.state))   // 每次状态变化都会推来新的 view state

async function runOneDrill(): Promise<void> {
  await runner.start()      // 加载采样 → 一次性出好整局题目 → 自动播放第一题
  runner.selectRank(0, 1)   // 第 1 个音放在第 1 位
  await runner.submit()     // 判分 → 重播本题真实音频 → phase 变成 revealed
  await runner.next()       // 下一题；最后一题答完后 finished 并存档
}
void runOneDrill()
```

`DrillRunner` 只对外暴露命令（`start` / `play` / `proposeRank` / `selectRank` / `submit` / `next` / `reset` / `setSpec` / `setReplayLimit` / `destroy`）、`getState()` 与 `subscribe()`；它不认识 React。`error` 事件额外带一句 `message`（例如重听次数用完），`state` 始终是最新的 view state。

### 只要规则：出题与判分

```ts
import {
  createDrillSpec, createExerciseGenerator, createRankOrderJudge,
  correctRanks, submitDraft, type RandomSource,
} from '@yuegan/core'
declare const random: RandomSource
const spec = createDrillSpec({ noteCount: 4, spanPattern: 'within-octave' })
const exercise = createExerciseGenerator(random).generate(spec, 'ex-1')
const judgment = createRankOrderJudge().judge(exercise, submitDraft(exercise, [...correctRanks(exercise)]))
judgment.isCorrect   // true：把音高按升序排回去永远是正确答案
```

出题器与判分器只依赖 `RandomSource` 这类端口，注入确定性实现就能复现任何一局，不需要 mock `Math.random`。

-----

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### 分层与依赖方向

| 目录 | 内容 |
|---|---|
| [`src/domain/value-objects/`](src/domain/value-objects/) | 音高（相对 C4 的半音数）、音名、音程与跨度、档位与名次、稀疏采样映射 |
| [`src/domain/entities/`](src/domain/entities/) | `drill-spec`、`exercise`、`answer`、`judgment`、`drill-session`：纯数据 `interface` 加操作它们的纯函数 |
| [`src/domain/services/`](src/domain/services/) | `exercise-generator`、`judge`——出题与判分的规则只住在这里 |
| [`src/domain/ports/`](src/domain/ports/) | `AudioPlayer`、`DrillRecordRepository`、`RandomSource`：只有接口，实现由平台注入 |
| [`src/application/`](src/application/) | `drill-runner`（一局编排）、`view-model`（组装 view state）、`emitter`（订阅） |

依赖方向单向：`application` → `domain`，`domain` 不依赖任何东西。领域对象是贫血模型——`interface` 不带方法，规则以纯函数形式住在 `domain/services` 与 `domain/entities`，这是 [ADR 0001](../../docs/adr/0001-domain-core-separated-from-platform.md) 的决定。

### 音高、档位与必须成立的不变量

音高是相对中央 C 的半音数（C4 = 0、C3 = −12、C5 = 12）；负数索引刻意保留，音高因此可排序、可相减得音程。档位是 1…n 的离散名次，n 恒等于本题音数，1 表示本题最低音——档位只在同一道题内有意义，所以作答存的是档位序列而不是音高序列。由此得到全部不变量：

1. 一道题有 n 个音，2 ≤ n ≤ 5（`MAX_NOTE_COUNT = 5`），互不相同且全部落在规格音域内；出题器对 `noteCount < 2` 抛错。
2. 档位数 == 本题音数，取值 1…n；答案必然是 1…n 的一个排列，由 `positionsOf` 唯一确定。
3. 一个档位最多被一个滑块占用：`assignRank` 处理冲突（互换，或让被抢者变为未作答），`assertNoDuplicateRanks` 复查，重复即抛错。
4. 八度内 = 整题跨度（最高音 − 最低音）≤ `OCTAVE_SEMITONES` = 12 个半音；全音域 = 不限制跨度。
5. 播放顺序随机打乱，否则答案恒为 1…n，一眼可解。
6. 判分只判方向：每个音的名次都对才整题算对（全对/全错），没有容差参数——档位是离散名次，不存在「差一点」的中间状态。
7. 整局题库在 `start()` 时一次性生成并固化，一题之内重听听到的永远是同一组音。

### 一局的命令与数据流

- `start()`：加载采样并上报进度 → 一次性生成整局题目、固化进 `DrillSession` → 自动播放第一题（`listening` → `answering`）。
- `play()` / `proposeRank()` / `selectRank()`：`play()` 消耗一次重听额度；「滑块停在哪」（proposal）与已选档位分开记录，因为原生 range 控件没有空值，未作答必须能和「选了第一档」区分。
- `submit()` / `next()` / `reset()`：提交时校验作答是 1…n 的排列 → 判分 → 重播本题真实音频（`revealed`）；切题前先作废可能还在播的回放（`playToken`）并 `stop()`，最后一题答完结算并存档（`finished`），`reset()` 回到 `idle`。

`getState()` 与 `subscribe()` 给出同一个 `DrillViewState`：phase、spec、每个滑块的档位选项（是否已选、是否被占用）、能不能提交、判分明细、replaysUsed / replayLimit、isPlaying、本局统计与结算 summary，以及 `forge`——整局题库的真实音高与正确答案快照，答题中界面不显示音高，但出题结果必须可核查。

### Extension points

改难度只给 `DrillSpec` 加字段，改出题分布改 `domain/services/exercise-generator.ts` 的 `enumerateWindows` 与 `sampleIndices`；换判分口径写一个 `Judge` 实现，从 `DrillRunnerDependencies.judge` 注入；换音色或播放方式实现 `AudioPlayer`，换记录存储实现 `DrillRecordRepository`，两者同样从 `DrillRunner` 的依赖注入；换界面只改 `apps/web/src/presentation/`，业务状态一律取自 `DrillViewState`。

新增一整种能力（绝对音高识别、参考音）没有现成端口可用：档位序列表达不了绝对音级，那要改 `Answer` 与判分口径。

每类形态的代码示例、判据与「功能 → 机制」表见[扩展形态参考](../../docs/extension-cookbook.md)。

### 采样映射与配置

Salamander 采样集是稀疏的：每 3 个半音只有一个采样（C / D# / F# / A），28 个文件覆盖 C1–A7（音高 −36…45）。`assignSample(pitch)` 取最近的采样，返回用哪个采样、变调几个半音、`playbackRate = 2^(detuneSemitones/12)`；整个采样范围内变调不超过 2 个半音，练习音域 C3–C5 内不超过 1 个半音。[sample-map 的测试](tests/sample-map.test.ts)直接读 `apps/web/public/samples/piano/` 目录核对映射表与磁盘文件一致，两边无法各自漂移。[`domain/config.ts`](src/domain/config.ts) 集中其余可调参数：`DEFAULT_PLAYBACK` 为每音 1200 ms、音间留白 400 ms，默认音域 C3–C5（`DEFAULT_RANGE`），一局 10 题（`DEFAULT_EXERCISE_COUNT`），每题重听上限 3 次（`DEFAULT_REPLAY_LIMIT`）。

</details>

-----

## Further Exploration

- [CONTEXT.md](../../CONTEXT.md) 与 [ADR 0001：领域核心与平台实现分离](../../docs/adr/0001-domain-core-separated-from-platform.md)——术语的唯一定义处，以及贫血模型、端口注入与「core 里出现一个浏览器 API 就算越界」的判据。
- [ADR 0002：用原生 Web Audio 而不是 Tone.js](../../docs/adr/0002-native-web-audio-over-tonejs.md)——采样映射为什么放在 core，播放器只做执行。
- [apps/web 的 React 接线](../../apps/web/src/presentation/use-drill.ts) 与三个平台侧实现：[采样加载](../../apps/web/src/infrastructure/piano-samples.ts)、[播放器适配器](../../apps/web/src/infrastructure/web-audio-piano-player.ts)、[localStorage 仓储](../../apps/web/src/infrastructure/local-storage-drill-record-repository.ts)——分别是订阅 view state 的那一端、`assignSample` 的消费者、`AudioPlayer` 与 `DrillRecordRepository` 端口的实现。

-----

## Known Limitations and Deferred Work

- **只判相对位置**——包内只有 `createRankOrderJudge` 一种判分口径：不问「这是哪个音」，只问「谁比谁高」。
- **绝对音高识别与参考音刻意不提供**——判断听到的音具体是哪个音，需要音级刻度与练习前给出的锚点音，属于另一种能力；档位本身就不是绝对音高。
- **音程判断未实现**——`intervalBetween` 目前只用于反馈文案。判分器的扩展点已经留好：作答结构是档位序列，再加一种判分口径不需要改数据结构。
- **重听只能重放整题**——`play()` 重新播放本题全部音，没有「只重放某一个音」的能力，因此用户必须记住整串音。
- **记录只存本地**——没有服务端、没有账号；`DrillRecord` 由平台实现的 `DrillRecordRepository` 保存，换设备不会带走成绩。
- **`DrillRunner.setSpec` 在一局进行中抛错**——`listening` / `answering` / `revealed` 三个阶段调用它会抛「一局练习进行中，不能更换规格」，换规格前必须先 `reset()`。
- **每道题最多 5 个音**——`MAX_NOTE_COUNT = 5`；一个滑块占一个档位，更多音在现有的滑块界面上无法表达。

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

- 改出题规则只改 `domain/services/exercise-generator.ts`，改判分口径只改 `domain/services/judge.ts`；不要在 `application/` 或界面里复制第二份规则。验证用 `pnpm test`（vitest run）与 `pnpm typecheck`（tsc -p tsconfig.json）。
- [`tests/`](tests/) 下 4 个文件、46 个测试；关键的性质测试对每种音数与跨度组合各跑 200 轮、每轮 10 题，穷举校验音数、互不相同、跨度、音域与「答案必为排列」，平台实现用桩替换（`FakeAudioPlayer` 与确定性 LCG 是模板）。

</details>
