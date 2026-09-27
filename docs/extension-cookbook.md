# 扩展形态参考（extension cookbook）

本文档回答一件事：想加某个东西时，它挂在哪个文件、哪个端口、哪个注入点，以及这次改动和 core 那几条不变量的关系。它是参考而不是教程：跟一遍完整改动的分步走法见[给练习加一个难度档](cookbook/adding-a-difficulty-tier.md)，跑通一局的最小用法在 [packages/core/README.md](../packages/core/README.md)，术语定义在 [CONTEXT.md](../CONTEXT.md)，架构取舍在 [ADR 0001](adr/0001-domain-core-separated-from-platform.md)、[ADR 0002](adr/0002-native-web-audio-over-tonejs.md) 与 [ADR 0003](adr/0003-earpath-curriculum-in-web.md)（课程壳住在 Web、排序题的规则仍然只有 core 一份），命令与目录在 [README.md](../README.md)。

代码块从包入口 `@yuegan/core` 导入，省略了工程装配（依赖注入、路由、样式），不是可以直接粘贴运行的文件；它们与 `pnpm typecheck` 用同一套严格配置编译过。

改动分三类，判据是「会不会让某条不变量失效」：「局部参数」只改 `DrillSpec` 的字段、`DIFFICULTY_TIERS` 或 `packages/core/src/domain/config.ts` 的数值；「新增实现」写一个新的 `Judge` / `AudioPlayer` / `DrillRecordRepository` 实现或新的界面：core 侧从 `DrillRunner` 的依赖注入，平台也可以在自己的会话层直接用它（Web 端不装配 `DrillRunner`，但排序题的播放确实装配了 `AudioPlayer`，见「换音色或换播放方式」）；「动领域模型」要改 `Answer`、判分口径与作答的表示，并重新确认答案唯一性由什么保证。下面用 ①…⑤ 指代这些改动最常牵动、也最容易被弄坏的几条规则——①②③ 是 core 的领域不变量（完整清单见 [packages/core/README.md](../packages/core/README.md)），④ 由出题语义与平台播放共同保证，⑤ 由界面守住：① 音互不相同 → 答案唯一；② 档位数 == 音数，答案必为 1…n 的排列；③ 一个档位最多一个滑块占用；④ 题目在开局时一次性生成并固化，一题之内重听听到同一组音；⑤ 答题中界面不显示音高/音名，真实音高只在反馈阶段出现。

## 加难度档或改出题分布

难度档（`DifficultyTier`）是「音域 + 跨度规则 + core 侧显示名」的一份定义：`DIFFICULTY_TIERS` 的每一项把这三样捆在一起，`DIFFICULTY_TIER_ORDER` 给出遍历顺序，`createDrillSpecForTier(tier, noteCount)` 再把档位与音数拼成 `DrillSpec`。加一档 = 扩展 `DifficultyTier` 联合类型、往 `DIFFICULTY_TIERS` 加一项、把它排进 `DIFFICULTY_TIER_ORDER`；core 侧到此就能出这一档的题。

**但界面上还看不到它**：Web 端的难度档不是首页按钮，而是 Pitch 模块排序关卡的属性。要让它露面，得在 `apps/web/src/course/curriculum.ts` 里用 `rankLevel(id, noteCount, tier)` 把它安排到某一关，并补上两份字典的 `tier.*` 显示名（关卡名与提示走 i18n，见文末表格）。分步走法见[给练习加一个难度档](cookbook/adding-a-difficulty-tier.md)。音数、题数、重听上限仍是 `DrillSpec` 的独立字段，音数的合法范围由 `MIN_NOTE_COUNT` / `MAX_NOTE_COUNT` 决定。

要一种新的跨度或音程约束（例如三度内、任意两音至少隔一个八度）才是改 core 的出题侧：`PitchSpanPattern` 加枚举值、给出这条规则的上界或下界（`maxSpanOf` 或同类纯函数），再让 `packages/core/src/domain/services/exercise-generator.ts` 的 `enumerateWindows`（合法起点）与 `sampleIndices`（取哪几个半音）按新规则工作。答案是升序名次，这类改动不碰 `Answer`。两条路都不碰作答表示与判分：不变量 ①②③④ 不受影响，⑤ 无关。

```ts
import {
  createDrillSpecForTier, describeDrillSpec, DIFFICULTY_TIERS, DIFFICULTY_TIER_ORDER,
  type DrillSpec,
} from '@yuegan/core'

/** 档位定义由 core 提供；显示成什么名字由平台决定（Web 端走 i18n 的 `tier.*`）。 */
export const tierLabels: readonly string[] = DIFFICULTY_TIER_ORDER.map((tier) => DIFFICULTY_TIERS[tier].label)
// → ['中音区', '全音域', '八度内']（core 的默认文案，Web 界面不用它）

/** 难度档 + 音数 → 规格：音域与跨度规则都来自档位定义，其余字段仍可覆盖。 */
export const spec: DrillSpec = createDrillSpecForTier('wide', 4, { exerciseCount: 5, replayLimit: 1 })
export const label = describeDrillSpec(spec) // "4 个音 · 全音域"
```

## 加一条音乐内容（新音程 / 新和弦 / 新音阶 / 新音级）

音乐事实住在 core，面向用户的名字住在平台——这条分工见 [ADR 0004](adr/0004-music-content-lives-in-core.md)。
所以加一条内容的完整走法是**两处**，只改一处不会被编译器拦住，靠 `apps/web/src/i18n/i18n.test.ts` 那条
「core 的每一条内容都有名字」的断言兜底（它比对 core 内容表的 id 与平台名字映射的 id 集合，多一个少一个都红）。

```ts
// 1) 事实：packages/core/src/domain/content/scales.ts
export const SCALES: Record<string, ScaleContent> = {
  // …原有内容不动…
  hungarian: { semitones: [0, 2, 3, 6, 7, 8, 11, 12] },   // 半音排列：首项 0、末项 12、严格递增
}

// 2) 名字：apps/web/src/i18n/domain-labels.ts
export const SCALE_NAME_KEYS: Record<string, string> = {
  // …原有内容不动…
  hungarian: 'theory.scale.hungarian',
}

// 3) 两份字典：apps/web/src/i18n/zh.ts 与 en.ts
//    'theory.scale.hungarian': '匈牙利小调' / 'Hungarian Minor'
```

然后把它排进某一关——`apps/web/src/course/curriculum.ts` 里对应模块的关卡 `items` 加这个 id 即可
（关卡与解锁是课程，不住 core）。不需要动任何生成器：音阶题的选项、播放与判分都按 id 走。

要守的性质分两层：**表本身**（半音排列的边界与单调性、级数引用的和弦真实存在）写在
`packages/core/tests/theory-content.test.ts`；**出题行为**（200 局里都能出到、播放事件落在音域内）
补在对应的题型测试或那张表的性质测试里。只断言「不抛错」是不够的——内容加错了往往表现为
「界面永远出不到它」或「显示成 id 本身」。

## 换判分口径（部分得分、更严的方向判定）

判分器是一个接口：`packages/core/src/domain/services/judge.ts` 的 `Judge` 只有 `judge(exercise, answer)`，范例实现是 `createRankOrderJudge()`；core 侧的注入点是 `DrillRunnerDependencies.judge`（`DrillRunner` 未注入时默认用它）。Web 端的排序题不走 `DrillRunner`：它在 `apps/web/src/questions/rank.ts` 里直接构造 `createRankOrderJudge()`，换口径就换那一处调用——两个装配点各自独立，改一处不会自动影响另一处。

判分结果的数据形状不变，装配处换成新实现即可（`new DrillRunner(spec, { audioPlayer, audioTiming: DEFAULT_PLAYBACK, judge: createNearMissJudge(1) })`），view state 的 `judgment` 明细与结算照旧工作，只是 `isCorrect` 的含义变了，要同步写进 [CONTEXT.md](../CONTEXT.md) 的「判分」；若新口径要求用户提交「音程是多少」「是哪个音级」这类作答，就不是换判分器，见最后一节。不变量 ①②③ 不受影响，④ 无关，⑤ 不变（反馈阶段本来就展示真实音高）。

换口径会牵动几处按默认口径渲染的显示，替换判分器时必须一并处理：Web 端排序题的逐音反馈取自 `judgment.details[].isCorrect` / `.correctRank` / `.answeredRank`（`apps/web/src/presentation/screens/PracticeScreen.tsx` 的 `RankAnswer` 与 `RankFeedback`），整题小结的「N 个音里排对了 M 个」取自 `judgment.matchedCount` / `.noteCount`；core 的 `DrillRunner` 那条路则由 `packages/core/src/application/view-model.ts` 的 `buildNoteViews` 组装逐音明细。它们都由判分器给出，但与判分器返回的整题 `isCorrect` 是各自独立的两条路径。上面这个容错判分器就会让界面出现「整题答对了，某一行却写着排错了」；要么让新判分器同时产出与它一致的自定义明细，要么改这两处的呈现。

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

端口是 `AudioPlayer`（`packages/core/src/domain/ports/audio-player.ts`）：`isReady` / `load(onProgress?)` / `playSequence(pitches, timing?)` / `stop`；core 侧的注入点是 `DrillRunnerDependencies.audioPlayer`，Web 端的实现是 `apps/web/src/infrastructure/audio/core-audio-player.ts` 的 `PianoEngineAudioPlayer`——它把 core 的半音坐标换算成 MIDI，再交给全站共用的 `apps/web/src/infrastructure/audio/piano-engine.ts` 发声（挑哪个采样、变调多少仍由 core 的 `assignSample` 决定）。

Web 上有两条播放路径，分工是清楚的：**排序题走这个端口**——`apps/web/src/questions/rank.ts` 的 `play` 调 `GenerateContext.playPitches(exercise.pitches)`，时序由 core 的 `DEFAULT_PLAYBACK` 给出，装配点在 `apps/web/src/presentation/useSession.ts`（`new PianoEngineAudioPlayer()`）；其余题型（音程、和弦、音阶、音级、和弦进行、旋律）直接调 `PianoEngine.playEvents(events)`，事件由 `apps/web/src/questions/events.ts` 的构造器算好——和弦、琶音、终止式这类材料需要精确到毫秒的时间轴，用事件表达更直接。换音色两处都要换，因为发声通道只有 `piano-engine.ts` 一个。

换音色库、加混响、输出 MIDI、在 Node 里跑无声测试都实现同一个端口；端口只按给定的音高序列与 `PlaybackTiming` 发声，重听次数、什么时候停、播哪几个音在 core 侧由 `DrillRunner` 决定、在 Web 侧由 `apps/web/src/presentation/useSession.ts` 与题目对象决定，播放器两种情况都不该自己改序列或时序。不变量 ①②③ 与声音无关；④ 要求播放器原样播放应用层给的那组音高，自己缓存或重新排序会破坏「一题之内重听听到同一组音」；⑤ 无关。

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

端口是 `DrillRecordRepository`（`packages/core/src/domain/ports/drill-record-repository.ts`）：`save` / `listRecent` / `clear`；`DrillRunner` 只要求 `save`（`DrillRunnerDependencies.recordRepository` 只声明了它），另外两个方法由消费端按需调用。

**Web 端不再装配这个端口**：`LocalStorageDrillRecordRepository` 已随旧的三页练习流程一起删除；端口与 `DrillRunner` 仍然留在 `packages/core`，并由 core 自己的行为测试覆盖（`packages/core/tests/drill-runner.test.ts` 用内存桩替换它）。Web 的进度存档换成了 app 层的模型——`apps/web/src/infrastructure/progress.ts`，localStorage 键 `yuegan.progress.v1`，按「技能项」与「关卡」两级记录，存的不是一局一局的 `DrillRecord`。要重新在 Web 上启用这个端口，就得自己写一个实现并接进会话流程：现在没有现成的注入点（`apps/web/src/presentation/useSession.ts` 直接调 `progress.ts`），要么在这一层接，要么另起一条 core 的 `DrillRunner` 装配。

存档字段（`DrillSpec`、`correctCount` / `totalCount`、逐题 `results`、`finishedAt`）属于领域，要往记录里加字段那是改 `DrillRecord`，不是换存储；存档抛错被 `DrillRunner` 吞掉，不影响这一局的推进。不变量 ①②③④ 都不涉及；换判分口径会让新旧记录的 `results` 含义不再一致，跨口径对比历史要说明用的是哪条口径。

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

采样映射是 core 里的纯逻辑：`packages/core/src/domain/value-objects/sample-map.ts` 的 `SALAMANDER_SAMPLE_NOTE_NAMES` 是音名表，`SALAMANDER_SAMPLE_PITCHES` 由它解析，`assignSample` 取最近采样并给出 `playbackRate = 2^(detuneSemitones/12)`；加载器按同一张表取文件（`apps/web/src/infrastructure/audio/piano-samples.ts` 把 `D#3` 读成 `Ds3.mp3`），发声的是 `apps/web/src/infrastructure/audio/piano-engine.ts`。

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

界面住在 `apps/web/src/presentation/`，页面路由在 `apps/web/src/app/App.tsx`（hash 路由：`#/` 首页、`#/module/:id` 模块页、`#/practice/:id/:level` 练习页、`#/daily` 每日混合、`#/stats`、`#/settings`、`#/guide`）。

一道题在界面上长什么样，由题型协议决定（`apps/web/src/questions/types.ts`）：`choice`（选项 + `grade(answeredId)`）、`sequence`（逐槽填级数序列）、`melody`（在钢琴上按出来）、`rank`（排序题：一列一个音，每列 n 个档位）。生成器都在 `apps/web/src/questions/` 下，由 `index.ts` 按**关卡**的 kind 派发（Pitch 模块内部同时有「比高低」与排序两种关卡）。生成器负责把题目该有的一切算好并闭包住——播放事件、正确答案、判分函数——界面只按协议渲染、把用户操作交回去，组件里不出现任何音乐判断。

会话循环由 `apps/web/src/presentation/useSession.ts` 的 reducer 驱动：进练习页先显示「点一下开始」，用户点击后才加载采样（28 个 mp3，约 1.8 MB），加载完自动播第一题；之后是出题 → 播放 → 作答 → 判分 → 下一题，`assign` / `submitRank` / `choose` / `fillSlot` / `playMelodyNote` 各自转发到当前题目的协议方法。生成器拿到的 `GenerateContext` 有两条播放通道：`play(events)` 直接给采样引擎事件（earpath 侧的题型），`playPitches(pitches, timing?)` 走 core 的 `AudioPlayer` 端口（排序题），见上一节。加页面、改交互、加动画、改文案都在这一层；一旦组件里开始写「这个档位还能不能选」的推导就已经越界。

排序题里，界面不推算任何规则：档位互斥与「被占了怎么办」来自 core 的 `assignRank`，能不能提交来自 `isDraftSubmittable`，规格与出题来自 `createDrillSpecForTier` / `createExerciseGenerator`，判分来自 `createRankOrderJudge`（`apps/web/src/questions/rank.ts` 只做「调 core、把音高交给播放端口、把判分结果接到界面协议上」的翻译）。而「一关要连对几题、模块怎么解锁、下一题偏向哪个薄弱项」是 app 层的课程概念，住在 `apps/web/src/course/curriculum.ts` 与 `apps/web/src/infrastructure/progress.ts`——这两类问题不要互相串门。

不变量 ⑤ 由界面守住：答题阶段不渲染真实音高与音名（排序题的音名只在反馈阶段用），也不给档位列标音名刻度；排查时用 `window.__yueganSession.truth()`（仅 DEV 构建暴露）读当前排序题的真实音高与正确答案，而不是从 DOM 反推。①②③ 在 core 里保证；④ 由「题目闭包住它自己那组音高」加上播放器原样播放共同保证。

```ts
import { assignRank, createAnswerDraft, isDraftSubmittable, type AnswerDraft } from '@yuegan/core'

/** 排序题的作答草稿与两条规则都从 core 来，界面只存草稿、只转发。 */
export const freshDraft = (noteCount: number): AnswerDraft => createAnswerDraft(noteCount)
export const applyPick = (draft: AnswerDraft, noteIndex: number, rank: number): AnswerDraft =>
  assignRank(draft, noteIndex, rank)
export const canSubmit = (draft: AnswerDraft, noteCount: number): boolean =>
  isDraftSubmittable(draft, noteCount)
```

## 把领域核心搬到别的平台（安卓端）

`packages/core` 原样复用，另写 `AudioPlayer` 与 `DrillRecordRepository` 的适配器加一套界面；判据是客观的——`packages/core/src` 里不出现任何浏览器 API（DOM、Web Audio、React、`localStorage`、`fetch`），这条边界与其代价记在 [ADR 0001](adr/0001-domain-core-separated-from-platform.md)。平台侧只做装配与渲染，业务规则一行都不复制；不变量都不动，跨平台最容易破的是 ④——在 core 的 `DrillRunner` 装配里，题目由它在 `start()` 时生成并固化；Web 端不走这条路，靠「题目闭包住它自己那组音高」守住同一条（排序题每次重听都把同一组 `exercise.pitches` 交给播放器）。平台侧若在重听时重新出题或改播别的音频，就不再是同一组音。

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
| 新难度档（音域 + 跨度规则 + core 侧显示名） | `DifficultyTier` 加字面量，再往 `DIFFICULTY_TIERS` / `DIFFICULTY_TIER_ORDER` 加一项（`packages/core/src/domain/entities/drill-spec.ts`）；再在 `apps/web/src/course/curriculum.ts` 里用 `rankLevel(id, noteCount, tier)` 把它安排到 Pitch 模块的一关，并补两份字典的 `tier.*` | 局部参数（①②③④ 不动） |
| 加一条音乐内容（新音程 / 和弦 / 音阶 / 音级） | 事实加进 `packages/core/src/domain/content/`，名字加进 `apps/web/src/i18n/domain-labels.ts` 与两份字典，再排进 `apps/web/src/course/curriculum.ts` 的关卡 | 局部参数 + 数据（①②③④ 不动；`i18n.test.ts` 会比对两边的 id 集合） |
| 加一个模块 / 一个关卡 | 模块与关卡加在 `apps/web/src/course/curriculum.ts`（关卡自带 `kind` 与 `nameKey` / `hintKey`），题型生成器加到 `apps/web/src/questions/`（新题型要在 `types.ts` 立协议、在 `index.ts` 派发），文案补进 `apps/web/src/i18n/zh.ts` 与 `apps/web/src/i18n/en.ts` 两份字典 | 局部参数 + 新增实现（都不动；课程规则不归 core 管） |
| 新跨度规则、音程约束或出题分布（三度内、任意两音隔一个八度、限定音阶） | `PitchSpanPattern` 加枚举值并给出上界/下界（`maxSpanOf` 或同类纯函数），再改 `packages/core/src/domain/services/exercise-generator.ts` 的 `enumerateWindows` 与 `sampleIndices` | 局部参数（①②③④ 不动；出题的性质测试要跟着改断言） |
| 部分得分 / 更严的方向判定 | 新 `Judge` 实现；core 侧注入 `DrillRunnerDependencies.judge`，Web 端换 `apps/web/src/questions/rank.ts` 里构造判分器的那一处 | 新增实现（不动；`Judgment.isCorrect` 的含义变了） |
| 音程判断（作答仍是档位） | 同上一行，另写 `Judge` | 新增实现（不动） |
| 换音色 / 换播放方式 | 实现 `AudioPlayer`，core 侧注入 `DrillRunnerDependencies.audioPlayer`；Web 端排序题的播放就装配 `apps/web/src/infrastructure/audio/core-audio-player.ts`（`useSession.ts` 里 `new PianoEngineAudioPlayer()`，经 `playPitches` 交给题型），其余题型直接调 `PianoEngine.playEvents(events)`；发声通道都是 `apps/web/src/infrastructure/audio/piano-engine.ts` | 新增实现（不动；④ 要求原样播放给定的音高序列） |
| 换记录存储（账号、服务端） | 实现 `DrillRecordRepository`，core 侧注入 `DrillRunnerDependencies.recordRepository`；Web 端不装配这个端口，进度走 `apps/web/src/infrastructure/progress.ts` | 新增实现（不动；要往记录里加字段才是动领域模型） |
| 扩采样音域 / 换采样集 | 加 mp3 到 `apps/web/public/samples/piano/`，同步 `sample-map.ts` 的音名表，必要时调 `DEFAULT_RANGE` | 局部参数 + 数据（都不动；`packages/core/tests/sample-map.test.ts` 保证表与磁盘一致） |
| 加界面 / 改交互 / 加页面 | `apps/web/src/presentation/`（会话循环 `useSession.ts`，页面在 `screens/`，路由在 `apps/web/src/app/App.tsx`），题目按 `apps/web/src/questions/types.ts` 的题型协议渲染，文案一律走 `t()` | 新增实现（不动；⑤ 由界面守住） |
| 安卓端 / Node 端 | 复用 `packages/core`，另写 `AudioPlayer` 与 `DrillRecordRepository` 适配器 + 界面 | 新增实现（都不动；判据是 `packages/core/src` 里没有浏览器 API） |
| 绝对音高识别 / 参考音 / 音程作答表 | `Answer` 表示 + `Judge` + `packages/core/src/application/view-model.ts` 的选项集 | 动领域模型（② 失效，③ 与 ⑤ 重新定义） |
