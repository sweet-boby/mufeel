# 扩展形态参考（extension cookbook）

本文档回答一件事：想加某个东西时，它挂在哪个文件、哪个端口、哪个注入点，以及这次改动和五条不变量的关系。它是参考而不是教程：跟一遍完整改动的分步走法见[给练习加一个难度档](cookbook/adding-a-difficulty-tier.md)，跑通一局的最小用法在 [packages/core/README.md](../packages/core/README.md)，术语定义在 [CONTEXT.md](../CONTEXT.md)，架构取舍在 [ADR 0001](adr/0001-domain-core-separated-from-platform.md) 与 [ADR 0002](adr/0002-native-web-audio-over-tonejs.md)，命令与目录在 [README.md](../README.md)。

代码块从包入口 `@yuegan/core` 导入，省略了工程装配（依赖注入、路由、样式），不是可以直接粘贴运行的文件；它们与 `pnpm typecheck` 用同一套严格配置编译过。

改动分三类，判据是「会不会让某条不变量失效」：「局部参数」只改 `DrillSpec` 的字段或 `packages/core/src/domain/config.ts` 的数值；「新增实现」写一个新的 `Judge` / `AudioPlayer` / `DrillRecordRepository` 实现或新的界面，从既有依赖注入进去；「动领域模型」要改 `Answer`、判分口径与 view state 的作答表示，并重新确认答案唯一性由什么保证。五条不变量编号沿用 [packages/core/README.md](../packages/core/README.md)：① 音互不相同 → 答案唯一；② 档位数 == 音数，答案必为 1…n 的排列；③ 一个档位最多一个滑块占用；④ 题目在开局时一次性生成并固化，一题之内重听听到同一组音；⑤ 答题中界面不显示音高/音名，真实音高只在反馈阶段出现。

## 加难度档或改出题分布

音数、跨度、音域、题数、重听上限全是 `DrillSpec` 的字段，`createDrillSpec` 只填默认值，界面上的选项从 `MIN_NOTE_COUNT` / `MAX_NOTE_COUNT` / `SPAN_PATTERN_LABELS` 生成，不写第二份数字。

要新增一种跨度规则或音程约束（例如三度内、任意两音至少隔一个八度）或换出题分布（限定音阶、指定音程集合）才是改 core：`PitchSpanPattern` 加枚举值、给出这条规则的上界或下界，再让 `packages/core/src/domain/services/exercise-generator.ts` 的 `enumerateWindows`（合法起点）与 `sampleIndices`（取哪几个半音）按新规则工作；答案是升序名次，这类改动不碰 `Answer`。不变量 ①②③④ 不受影响，出题器换的只是取音方式；⑤ 无关。

```ts
import { createDrillSpec, describeDrillSpec, type DrillSpec } from '@yuegan/core'

/** 加一档「八度内、4 个音、练 5 题、重听 1 次」：只给字段。 */
export const spec: DrillSpec = createDrillSpec({
  noteCount: 4, spanPattern: 'within-octave', exerciseCount: 5, replayLimit: 1,
})

export const label = describeDrillSpec(spec) // "4 个音 · 八度内"
```

## 换判分口径（部分得分、更严的方向判定）

判分器是一个接口：`packages/core/src/domain/services/judge.ts` 的 `Judge` 只有 `judge(exercise, answer)`，范例实现是 `createRankOrderJudge()`；`DrillRunner` 未注入时默认用它，注入点是 `DrillRunnerDependencies.judge`。

判分结果的数据形状不变，装配处换成新实现即可（`new DrillRunner(spec, { audioPlayer, audioTiming: DEFAULT_PLAYBACK, judge: createNearMissJudge(1) })`），view state 的 `judgment` 明细与结算照旧工作，只是 `isCorrect` 的含义变了，要同步写进 [CONTEXT.md](../CONTEXT.md) 的「判分」；若新口径要求用户提交「音程是多少」「是哪个音级」这类作答，就不是换判分器，见最后一节。不变量 ①②③ 不受影响，④ 无关，⑤ 不变（反馈阶段本来就展示真实音高）。

换口径会牵动两处按默认口径渲染的显示，替换判分器时必须一并处理：逐音反馈行的「排对了 / 排错了」取自 `judgment.details[].isCorrect`（`view-model.ts` 的 `buildNoteViews`），结果页的「错 N/M」取自 `judgment.matchedCount`——两者都由判分器给出，但与判分器返回的整题 `isCorrect` 是各自独立的两条路径。上面这个容错判分器就会让界面出现「整题答对了，某一行却写着排错了」；要么让新判分器同时产出与它一致的自定义明细，要么改这两处的呈现。

```ts
import {
  createJudgment, correctRanks, exerciseNoteCount, isCompleteAssignment,
  type Answer, type Exercise, type Judge, type Judgment, type RankSequence,
} from '@yuegan/core'

/** 容错一档：n 个音里最多排错一个也算对。作答仍是 1…n 的档位排列。 */
export function createNearMissJudge(tolerance = 1): Judge {
  return {
    judge(exercise: Exercise, answer: Answer): Judgment {
      const ranks = answer.ranks as RankSequence
      if (!isCompleteAssignment(ranks, exerciseNoteCount(exercise))) throw new Error('作答必须是 1…n 的一个排列')
      const judged = createJudgment(exercise.id, ranks, correctRanks(exercise))
      return { ...judged, isCorrect: judged.matchedCount >= judged.noteCount - tolerance }
    },
  }
}
```

## 换音色或换播放方式

端口是 `AudioPlayer`（`packages/core/src/domain/ports/audio-player.ts`）：`isReady` / `load(onProgress?)` / `playSequence(pitches, timing?)` / `stop`；现有实现是 `apps/web/src/infrastructure/web-audio-piano-player.ts`（原生 Web Audio + `assignSample` 的变速），注入点是 `DrillRunnerDependencies.audioPlayer`。

换音色库、加混响、输出 MIDI、在 Node 里跑无声测试都实现同一个端口；端口只按给定的音高序列与 `PlaybackTiming` 发声，重听次数、什么时候停、播哪几个音都由 `DrillRunner` 决定，播放器不该自己改序列或时序。不变量 ①②③ 与声音无关；④ 要求播放器原样播放应用层给的那组音高，自己缓存或重新排序会破坏「一题之内重听听到同一组音」；⑤ 无关。

```ts
import type { AudioPlayer, PlaybackTiming, Semitones } from '@yuegan/core'

/** 换播放方式：包一层既有播放器，把领域给的时序整体放慢。 */
export class SlowPlayer implements AudioPlayer {
  constructor(private readonly inner: AudioPlayer, private readonly factor: number) {}
  isReady(): boolean { return this.inner.isReady() }
  load(onProgress?: (ratio: number) => void): Promise<void> { return this.inner.load(onProgress) }
  playSequence(pitches: readonly Semitones[], timing?: PlaybackTiming): Promise<void> {
    const slowed = timing === undefined ? undefined
      : { noteDurationMs: timing.noteDurationMs * this.factor, noteGapMs: timing.noteGapMs * this.factor }
    return this.inner.playSequence(pitches, slowed)
  }
  stop(): Promise<void> { return this.inner.stop() }
}
```

## 换记录存储

端口是 `DrillRecordRepository`（`packages/core/src/domain/ports/drill-record-repository.ts`）：`save` / `listRecent` / `clear`；现有实现是 `apps/web/src/infrastructure/local-storage-drill-record-repository.ts`（localStorage 键 `yuegan.drill-records.v1`，最多 200 局）。`DrillRunner` 只要求 `save`（`DrillRunnerDependencies.recordRepository` 只声明了它），`listRecent` / `clear` 由首页的最近成绩与「清空历史记录」调用。

存档字段（`DrillSpec`、`correctCount` / `totalCount`、逐题 `results`、`finishedAt`）属于领域，要往记录里加字段那是改 `DrillRecord`，不是换存储；存档抛错被 `DrillRunner` 吞掉，不影响结果页。不变量 ①②③④ 都不涉及；换判分口径会让新旧记录的 `results` 含义不再一致，跨口径对比历史要说明用的是哪条口径。

```ts
import type { DrillRecord, DrillRecordRepository } from '@yuegan/core'

/** 换记录存储：账号、服务端、IndexedDB、内存都只是换这个实现。 */
export class MemoryRecordRepository implements DrillRecordRepository {
  #records: DrillRecord[] = []
  async save(record: DrillRecord): Promise<void> { this.#records = [record, ...this.#records] }
  async listRecent(limit: number): Promise<readonly DrillRecord[]> { return this.#records.slice(0, limit) }
  async clear(): Promise<void> { this.#records = [] }
}
```

## 扩采样音域或换采样集

采样映射是 core 里的纯逻辑：`packages/core/src/domain/value-objects/sample-map.ts` 的 `SALAMANDER_SAMPLE_NOTE_NAMES` 是音名表，`SALAMANDER_SAMPLE_PITCHES` 由它解析，`assignSample` 取最近采样并给出 `playbackRate = 2^(detuneSemitones/12)`；加载器按同一张表取文件（`apps/web/src/infrastructure/piano-samples.ts` 把 `D#3` 读成 `Ds3.mp3`）。

往稀疏表里补采样点、整体换一套采样集（同时改加载器目录）都走这条路：把 mp3 放进 `apps/web/public/samples/piano/` 并同步音名表，必要时再调 `DEFAULT_RANGE`；只换音色而沿用同一套采样，只改播放器的取样方式，不动音名表。`packages/core/tests/sample-map.test.ts` 直接读那个目录核对一一对应，两边不能各自漂移；不变量都不受影响——采样只决定「同一个音高听起来是什么」，答案仍由音高唯一确定。

```ts
import { assignSample, maxDetuneSemitones, SALAMANDER_SAMPLE_NOTE_NAMES, sampleRange } from '@yuegan/core'

/** 覆盖音域与最大变调都从音名表推出来，文档与播放器不抄第二份数字。 */
export const sampleCount = SALAMANDER_SAMPLE_NOTE_NAMES.length // 28
export const covered = sampleRange()                            // { min: -36, max: 45 }，即 C1–A7
export const worstDetune = maxDetuneSemitones()                 // 2 个半音
export const beyondTop = assignSample(covered.max + 2)          // 越界的音先夹回采样范围
```

## 加界面或改交互

界面住在 `apps/web/src/presentation/`，业务状态只能来自 `packages/core/src/application/view-model.ts` 产出的 `DrillViewState`：能不能提交是 `canSubmit`，某个档位是否被占是 `exercise.notes[i].options[j].isTakenByOther`，还能听几次是 `replaysUsed` / `replayLimit`，逐音对错在 `judgment` 与反馈字段里。

订阅方式见 `apps/web/src/presentation/use-drill.ts`：`DrillRunner.subscribe(listener)` 先同步推一次当前 state，之后每次状态变化再推一次；命令是 `start` / `play` / `proposeRank` / `selectRank` / `submit` / `next` / `reset` / `setSpec` / `setReplayLimit` / `destroy`。加页面、改滑块交互、加动画、改文案都在这一层；一旦组件里开始写「这个档位还能不能选」的推导就已经越界。不变量 ⑤ 完全由界面守住：答题阶段不渲染 `exercise.truthNoteNames` 与 `exercise.notes[].feedback`（判分前都是 `null`），也不给滑块标音名刻度，`forge` 只用于核对排查；①②③④ 在 core 里保证。

```ts
import { useEffect, useState } from 'react'
import type { DrillRunner, DrillViewState } from '@yuegan/core'

/** 界面与领域之间唯一的接缝：订阅 view state，不推算规则。 */
export function useDrillState(runner: DrillRunner): DrillViewState {
  const [state, setState] = useState<DrillViewState>(() => runner.getState())
  useEffect(() => runner.subscribe((event) => setState(event.state)), [runner])
  return state
}
```

## 把领域核心搬到别的平台（安卓端）

`packages/core` 原样复用，另写 `AudioPlayer` 与 `DrillRecordRepository` 的适配器加一套界面；判据是客观的——`packages/core/src` 里不出现任何浏览器 API（DOM、Web Audio、React、`localStorage`、`fetch`），这条边界与其代价记在 [ADR 0001](adr/0001-domain-core-separated-from-platform.md)。平台侧只做装配与渲染，业务规则一行都不复制；不变量都不动，跨平台最容易破的是 ④——题目由 core 在 `start()` 时生成并固化，平台侧若在重听时重新出题或改播别的音频，就不再是同一组音。

```ts
import { DEFAULT_PLAYBACK, DrillRunner, createDrillSpec, type AudioPlayer, type DrillRecordRepository } from '@yuegan/core'

/** 别的平台的装配：core 一行不改，只换这两个适配器与界面。 */
export function createRunner(audioPlayer: AudioPlayer, recordRepository: DrillRecordRepository): DrillRunner {
  const spec = createDrillSpec({ noteCount: 3, spanPattern: 'within-octave' })
  return new DrillRunner(spec, { audioPlayer, audioTiming: DEFAULT_PLAYBACK, recordRepository })
}
```

## 新增一整种能力（绝对音高识别、参考音）

这一项必须动领域模型：档位是 1…n 的相对名次，表达不了绝对音级，所以 `packages/core/src/domain/entities/answer.ts` 的作答表示、判分口径、`view-model.ts` 的滑块选项集都要改，并重新回答「答案唯一性由什么保证」——相对位置靠音互不相同，绝对音级要靠音级刻度与练习前的参考音。

这不是加参数，是加能力；绝对音高识别与参考音今天刻意未实现，定义见 [CONTEXT.md](../CONTEXT.md)。音程判断若仍以档位序列作答（只把「相邻两音差几个半音」作为附加作答）可以只加一个 `Judge` 实现，一旦作答本身要换成音级或音程表就落到本节。不变量 ② 直接失效（答案不再是 1…n 的排列），③ 随作答表示一起重新定义，① 与 ④ 仍要保留（音互不相同、题目一次性固化）；⑤ 需要重画——绝对音高识别要靠音级刻度与参考音作答，答题阶段与反馈阶段的显示边界要重新决定。

```ts
import { positionsOf, type RankSequence } from '@yuegan/core'

// 同一段旋律的高八度版本给出完全一样的作答：档位表示丢掉了绝对音高。
const low: RankSequence = positionsOf([-12, 0, 7])
const high: RankSequence = positionsOf([0, 12, 19])
export const sameAnswer: boolean = low.join(',') === high.join(',')
```

## 功能 → 机制

| 想加的东西 | 挂在哪 | 不变量 |
| --- | --- | --- |
| 新难度档（音数、音域、题数、重听上限） | `createDrillSpec` 的字段（`packages/core/src/domain/entities/drill-spec.ts`），界面选项从 `MIN_NOTE_COUNT` / `MAX_NOTE_COUNT` / `SPAN_PATTERN_LABELS` 生成 | 局部参数（①②③④ 不动） |
| 新跨度规则、音程约束或出题分布（三度内、任意两音隔一个八度、限定音阶） | `PitchSpanPattern` 加枚举值并给出上界/下界（`maxSpanOf` 或同类纯函数），再改 `packages/core/src/domain/services/exercise-generator.ts` 的 `enumerateWindows` 与 `sampleIndices` | 局部参数（①②③④ 不动；出题的性质测试要跟着改断言） |
| 部分得分 / 更严的方向判定 | 新 `Judge` 实现，注入 `DrillRunnerDependencies.judge` | 新增实现（不动；`Judgment.isCorrect` 的含义变了） |
| 音程判断（作答仍是档位） | 同上一行，另写 `Judge` | 新增实现（不动） |
| 换音色 / 换播放方式 | 实现 `AudioPlayer`，注入 `DrillRunnerDependencies.audioPlayer`（范例 `apps/web/src/infrastructure/web-audio-piano-player.ts`） | 新增实现（不动；④ 要求原样播放给定的音高序列） |
| 换记录存储（账号、服务端） | 实现 `DrillRecordRepository`，注入 `DrillRunnerDependencies.recordRepository` | 新增实现（不动；要往记录里加字段才是动领域模型） |
| 扩采样音域 / 换采样集 | 加 mp3 到 `apps/web/public/samples/piano/`，同步 `sample-map.ts` 的音名表，必要时调 `DEFAULT_RANGE` | 局部参数 + 数据（都不动；`packages/core/tests/sample-map.test.ts` 保证表与磁盘一致） |
| 加界面 / 改交互 / 加页面 | `apps/web/src/presentation/`，状态只从 `DrillViewState` 取 | 新增实现（不动；⑤ 由界面守住） |
| 安卓端 / Node 端 | 复用 `packages/core`，另写 `AudioPlayer` 与 `DrillRecordRepository` 适配器 + 界面 | 新增实现（都不动；判据是 `packages/core/src` 里没有浏览器 API） |
| 绝对音高识别 / 参考音 / 音程作答表 | `Answer` 表示 + `Judge` + `view-model.ts` 的滑块选项 | 动领域模型（② 失效，③ 与 ⑤ 重新定义） |
