# 教程：给练习加一个难度档

读者起点与终点：起点是读过 [CONTEXT.md](../../CONTEXT.md) 的术语表、能在本地跑 `pnpm dev` 与 `pnpm test`；终点是首页多一个难度按钮「八度以上」，这一档的每道题里任意两个音至少隔一个八度，并且有测试守住这条性质。

例子是给 `spanPattern` 加第四个取值 `'wide'`：只加一个规格取值与一处出题约束，不动答案模型。代码改动落在四个文件：`packages/core/src/domain/entities/drill-spec.ts`、`packages/core/src/domain/services/exercise-generator.ts`、`apps/web/src/presentation/home-screen.tsx`、`packages/core/tests/exercise.test.ts`。

## 1. 先想清楚这次改动动的是什么

难度只由 `DrillSpec` 表达（`noteCount` / `spanPattern` / `range` / `exerciseCount` / `replayLimit`），构造入口是 `createDrillSpec`，默认值来自 `DEFAULT_RANGE`（C3–C5）、`DEFAULT_EXERCISE_COUNT`、`DEFAULT_REPLAY_LIMIT`；加难度档就是给规格加参数。

`'wide'` 约束的是音程（任意两音至少差 12 个半音），不是跨度（最高音 − 最低音的上界）。[CONTEXT.md](../../CONTEXT.md) 已经把这两个词分开定义：现有两种难度限跨度，新档位限两两之间的最小间隔，两者不能互相顶替——3 个音两两间隔 ≥ 12 时，跨度必然至少 24。

改出题规则前记住这几条不能破坏的不变量（[packages/core/README.md](../../packages/core/README.md) 也列着）：音互不相同答案才唯一；档位数 == 本题音数，正确答案必是 1…n 的排列；一个档位最多被一个滑块占用（`assignRank` 会断言）；整局题库在 `start()` 时一次性生成并固化，一局之内不变。

## 2. 在 drill-spec.ts 里加取值、标签与最小间隔

文件：`packages/core/src/domain/entities/drill-spec.ts`。加取值、中文标签与最小间隔：

```ts
export type PitchSpanPattern = 'within-octave' | 'unrestricted' | 'wide';
export const SPAN_PATTERN_LABELS: Record<PitchSpanPattern, string> = {
  'within-octave': '八度内',
  unrestricted: '全音域',
  wide: '八度以上',
};
/** 一道题里任意两音的最小间隔；半音是整数，互不相同即至少差 1。 */
export function minGapOf(spec: DrillSpec): number {
  return spec.spanPattern === 'wide' ? OCTAVE_SEMITONES : 1;
}
```
为什么必须做：`SPAN_PATTERN_LABELS` 是 `Record<PitchSpanPattern, string>`，漏掉新取值时 `pnpm typecheck` 直接报缺 key；它也是界面按钮、练习页顶部与结算页规格文案的唯一来源（`describeDrillSpec` 输出「5 个音 · 八度以上」），缺了用户就会看到 `undefined`。`minGapOf` 对现有两种难度返回 1（互不相同的整数本来至少差 1），出题器因此能用同一条规则处理三种难度；`OCTAVE_SEMITONES`（= 12）本来就在这个文件里。

`maxSpanOf` 一个字都不改：它返回跨度上界，`enumerateWindows` 用它决定窗口能开多宽、`generate` 用它算窗口里有几个半音、`sampleIndices` 用它决定取几个位置；把两音间隔的下界塞进去，等于把音域当成一个八度，5 个音直接放不下。

加默认音域的映射：

```ts
/** C1–C6：'wide' 出 5 个音时需要至少 48 个半音的宽度。 */
export const WIDE_RANGE: PitchRange = { min: -36, max: 24 };
export const RANGE_BY_SPAN_PATTERN: Record<PitchSpanPattern, PitchRange> = {
  'within-octave': DEFAULT_RANGE, unrestricted: DEFAULT_RANGE, wide: WIDE_RANGE,
};
```
`createDrillSpec` 里只改一行：`range: DEFAULT_RANGE` 变成 `range: RANGE_BY_SPAN_PATTERN[overrides.spanPattern]`；`...overrides` 仍在最后，调用方还能自己传 `range`（第 5 步的测试就靠它构造放不下的配置）。

为什么必须做：`DEFAULT_RANGE`（C3–C5）只有 25 个半音（−12…12），n 个音两两间隔 ≥ 12 至少要 (n−1) × 12 个半音的自由度，所以 2 个音要 12（放得下）、3 个音要 24（刚好等于音域宽度，只有 C3 / C4 / C5 一种组合）、4 个音要 36、5 个音要 48（都放不下）。不想拉宽音域就只能把这一档的音数限制在 2～3，那要连首页的音数选项一起改。C1–C6 宽度是 60，5 个音仍有余量，整段也在采样覆盖范围（C1–A7）内。

## 3. 在 exercise-generator.ts 里实现约束

文件：`packages/core/src/domain/services/exercise-generator.ts`。约束分两层：窗口层决定这个窗口放不放得下，取音层决定在放得下的窗口里怎么取。

窗口层：`enumerateWindows` 只保留放得下 n 个两两间隔 ≥ minGap 的音的窗口起点，`const minGap = minGapOf(spec);` 加在函数开头，末尾 `windows.length > 0 ? windows : [spec.range.min]` 的兜底不变。取音层：`sampleIndices` 多收一个 `minGap`，每取一个音就按「后面还要放几个音」留出余量，取出来天然升序且间隔达标。

```ts
/** 长度为 windowSpan 个半音的窗口最多能放几个两两间隔 ≥ minGap 的音。 */
function capacityOf(windowSpan: number, minGap: number): number {
  return Math.floor(windowSpan / minGap) + 1;
}
for (let start = spec.range.min; start + span <= spec.range.max; start += 1) {
  if (capacityOf(Math.min(span, spec.range.max - start), minGap) >= spec.noteCount) {
    windows.push(start);
  }
}
/** 从 [0, slotCount) 里取 count 个下标，升序返回，任意两个间隔 ≥ minGap。 */
function sampleIndices(slotCount: number, count: number, minGap: number, random: RandomSource): number[] {
  const chosen: number[] = [];
  let cursor = 0;
  for (let picked = 0; picked < count; picked += 1) {
    const remaining = count - picked - 1;
    const span = slotCount - 1 - remaining * minGap - cursor + 1;
    const value = cursor + Math.min(Math.floor(random.next() * span), span - 1);
    chosen.push(value);
    cursor = value + minGap;
  }
  return chosen;
}
```
只要 `slotCount ≥ (count−1) × minGap + 1`，每一步的可选范围都非空，所以不需要「随机重试直到合法」。

一处取舍：这段实现让三种难度共用一条取样路径，`minGap = 1` 时它保证的仍然是「互不相同」，但取值分布与改动前不同（改动前是从整个窗口等概率抽 count 个位置）；在意现有两档题目分布的话，就把上面这份实现单独命名为 `sampleIndicesWithGap`，`minGap === 1` 时继续用原来的 `sampleIndices`，在 `generate` 里按 `minGap` 分派。

`generate` 里把「放得下」的判据推广到最小间隔，放不下就当场抛错（`minGap` 仍由 `minGapOf(spec)` 取得，import 行改成 `import { maxSpanOf, minGapOf } from '../entities/drill-spec';`）：

```ts
const windowSpan = Math.min(maxSpanOf(spec), spec.range.max - windowStart);
if (capacityOf(windowSpan, minGap) < noteCount) {
  throw new Error(`音域内放不下 ${noteCount} 个间隔至少 ${minGap} 个半音的音（可用半音数 ${windowSpan + 1}）`);
}
const offsets = sampleIndices(windowSpan + 1, noteCount, minGap, random);
```
为什么两层都要：窗口层让随机取窗口时不会取到根本放不下的窗口，也不会让恰好放得下的窗口靠运气才被抽到；判断本身仍留在 `generate`，因为 `enumerateWindows` 在音域比跨度还窄时会退化成只有一个兜底窗口，那条路径必须由这句判据接住，而且它要在取音之前给出错误，不能等 `sampleIndices` 取不满才发现。`minGap = 1` 时 `capacityOf(windowSpan, 1)` 等于原来的 `slotCount`，这句判断与改动前完全等价。

## 4. 接上界面

文件：`apps/web/src/presentation/home-screen.tsx`，两张表各加一项（只贴新增项，完整内容以该文件为准）：

```ts
// SPAN_OPTIONS 末尾追加：它只是难度的出现顺序
'wide'
// SPAN_HINTS 末尾追加：选中后显示在按钮下方
wide: '任意两个音至少隔一个八度，高低差拉得很开',
```

`SPAN_OPTIONS` 决定按钮的出现与顺序，`SPAN_HINTS` 决定选中后显示在按钮下面那行提示。按钮文案不在这里写：渲染用的是 core 的 `SPAN_PATTERN_LABELS[pattern]`，这样首页、练习页顶部、结算页的规格文案只有一处来源；`SPAN_HINTS` 的键类型是 `Record<PitchSpanPattern, string>`，漏一项就是类型错误，所以新增难度时编译器会提醒你补这一条。

`createSpecFromChoice`（`apps/web/src/presentation/use-drill.ts`）不用改：它已经走 `createDrillSpec`，音域由第 2 步的 `RANGE_BY_SPAN_PATTERN` 决定。界面这一层没有新增业务判断——能提交、哪个档位被占用、还能听几次、真实音高是什么，仍然全部来自 view state。顺手修掉列举难度的说法：根 `README.md` 的「两种难度」、`packages/core/README.md` 不变量第 4 条、`CONTEXT.md` 里「跨度」那条只举了 `八度内` 的例子；`pnpm test:docs` 只验路径、命令与相对链接，发现不了这类过时句子。

## 5. 补测试

文件：`packages/core/tests/exercise.test.ts`，性质测试的难度数组加一项，并把 `'wide'` 的分支插在原有 `if/else` 链前面：

```ts
for (const spanPattern of ['within-octave', 'unrestricted', 'wide'] as const) {
  // ...原有断言
  if (spanPattern === 'wide') {
    const ascending = [...exercise.pitches].sort((a, b) => a - b);
    for (let at = 1; at < ascending.length; at += 1) {
      expect((ascending[at] as number) - (ascending[at - 1] as number)).toBeGreaterThanOrEqual(12);
    }
  }
}
```
这段循环对每种音数 × 每种跨度各跑 200 轮、每轮 10 题，逐题断言：音数正确、每个音都在音域内、音互不相同、升序后相邻间隔 ≥ 12（相邻达标即两两达标）、`correctRanks` 是 1…n 的排列。用穷举性质测试而不是单个固定随机源用例，是因为 `lcg(seed)` 能复现，但只有把每种音数与每种难度都跑满，才能证明约束在每个分支上都成立。

再加一条把「放不下」写死的用例：`createDrillSpec({ noteCount: 5, spanPattern: 'wide', range: { min: -12, max: 12 } })` 这种规格必须让 `createExerciseGenerator(lcg(1)).generate(spec, 'ex')` 抛错（`expect(...).toThrow(/放不下/)`），防止以后有人调窄音域后悄悄出一道具题。C3–C5 配 5 个音就是这种配置：音数越大，`'wide'` 需要的音域越宽，这是产品约束不是实现偷懒。采样侧不用改测试：[sample-map.test.ts](../../packages/core/tests/sample-map.test.ts) 已经在 C1–A7 上断言变调不超过 2 个半音，覆盖了新的 C1–C6。

## 6. Verify

```sh
pnpm typecheck   # 两个包的 tsc 必须干净
pnpm test        # 出题器性质测试 + 放不下时的抛错用例
pnpm test:docs   # 改了根 README.md / CONTEXT.md / packages/core/README.md 之后必跑
pnpm dev         # http://localhost:5173
```

- `pnpm typecheck` 干净：`SPAN_PATTERN_LABELS`、`RANGE_BY_SPAN_PATTERN`、`SPAN_HINTS` 都是 `Record<PitchSpanPattern, ...>`，漏一项就红。
- `pnpm test` 通过：`'wide'` 每道题升序后相邻间隔 ≥ 12、音全在音域内、`correctRanks` 仍是排列；用 C3–C5 配 5 个音构造规格时抛「放不下」。
- 浏览器里点一遍：首页第三个难度按钮是「八度以上」，选「5 个音 + 八度以上」开始一局，走完看结算页的规格文案也是这四个字；首页没出现新按钮时先怀疑 Vite 的旧模块缓存——改 `packages/core` 源码后 HMR 有时不重载它，重启 `pnpm dev` 并删掉 `node_modules/.vite` 再看一次。
- 核对真实音高只认领域状态，不从 DOM 反推：控制台执行 `window.__yueganRunner.getState().forge`（仅 DEV 构建暴露），`forge[i].pitches` 是第 i 题按播放顺序的真实音高，升序后相邻差必须 ≥ 12，`forge[i].correctRanks` 是这道题的正确答案。
