# 教程：给练习加一个难度档

读者起点与终点：起点是读过 [CONTEXT.md](../../CONTEXT.md) 的术语表、能在本地跑 `pnpm dev` 与 `pnpm test`；终点是首页多一个难度按钮「两个八度内」，这一档的每道题里所有音落在 24 个半音之内，并且有测试守住这条性质与它的边界。

例子是加一档"限制跨度为两个八度"的练习。它同时演示两件事：加一档难度要动哪些地方，以及当一档需要**新的跨度规则**时，规则该加在哪个函数里。

## 1. 先想清楚这次改动动的是什么

难度是给人挑的入口，它由两件事一起定义：**出题音域**与**跨度规则**。这两件事都在 `packages/core/src/domain/entities/drill-spec.ts` 里的难度档表里放着：

```ts
export interface DifficultyTierDefinition {
  readonly label: string;
  readonly hint: string;
  readonly range: PitchRange;
  readonly spanPattern: PitchSpanPattern;
}
```

出题器不认识"难度档"，它只认 `DrillSpec`（音数 + 音域 + 跨度规则 + 题数 + 重听上限）。所以加一档永远是同一套路：**先给规格加一种取值，再给难度档表加一项**，界面按钮会自动出现。

这次要加的是"跨度 ≤ 24 个半音"，也就是一种新的 `PitchSpanPattern` 取值（现有的 `within-octave` 是 ≤ 12，`unrestricted` 是不限制）。

改之前记住这几条不能破坏的不变量（[packages/core/README.md](../../packages/core/README.md) 也列着）：音互不相同答案才唯一；档位数 == 本题音数，正确答案必是 1…n 的排列；一个档位最多被一个滑块占用（`assignRank` 会断言）；整局题库在 `start()` 时一次性生成并固化，一局之内不变。这个改动只换取音范围，四条都不受影响。

## 2. 在 drill-spec.ts 里加跨度取值

文件：`packages/core/src/domain/entities/drill-spec.ts`。取值与它的上界：

```ts
export type PitchSpanPattern = 'within-octave' | 'two-octaves' | 'unrestricted';

/** 两个八度 = 24 个半音。 */
export const TWO_OCTAVE_SEMITONES = 24;
```

`SPAN_PATTERN_LABELS` 是 `Record<PitchSpanPattern, string>`，漏一项 `pnpm typecheck` 就报缺 key，所以编译器会提醒你补上它——补 `'two-octaves': '两个八度内'`。

上界要加在 `maxSpanOf` 里，它是出题器判断窗口宽度的唯一依据：

```ts
export function maxSpanOf(spec: DrillSpec): number {
  if (spec.spanPattern === 'within-octave') {
    return OCTAVE_SEMITONES;
  }
  if (spec.spanPattern === 'two-octaves') {
    return TWO_OCTAVE_SEMITONES;
  }
  return spec.range.max - spec.range.min;
}
```

为什么必须做：`enumerateWindows` 用 `maxSpanOf(spec)` 决定窗口能开多宽，`generate` 用它算窗口里有几个半音，`sampleIndices` 用它决定取几个位置——出题器一行都不用改，新档就自然生效了。这也是**判断一个难度档贵不贵的方法**：如果它能表达成一个跨度上界，就只动这一个函数；如果要的是"两两之间至少隔多远"这种下界，出题器的取音算法就得改（[扩展形态参考](../extension-cookbook.md) 里有这条判据）。

## 3. 在难度档表里加一项

同一文件。音域这一档沿用中音区 `DEFAULT_RANGE`（C3–C5，宽 24 个半音，刚好放得下 24 的跨度）：

```ts
export type DifficultyTier = 'standard' | 'octave' | 'two-octaves' | 'wide';

export const DIFFICULTY_TIERS: Record<DifficultyTier, DifficultyTierDefinition> = {
  // …原有三项不动…
  'two-octaves': {
    label: '两个八度内',
    hint: '所有音落在两个八度之内，比全音域紧、比八度内松',
    range: DEFAULT_RANGE,
    spanPattern: 'two-octaves',
  },
};

export const DIFFICULTY_TIER_ORDER: readonly DifficultyTier[] = [
  'standard', 'two-octaves', 'wide', 'octave',
];
```

`DIFFICULTY_TIER_ORDER` 决定按钮的出现顺序，`DIFFICULTY_TIERS` 提供文案与提示；两个都是 `Record` / 数组字面量，漏写一项同样是类型错误。

## 4. 界面不需要改

`apps/web/src/presentation/home-screen.tsx` 按 `DIFFICULTY_TIER_ORDER` 渲染按钮，文案与提示取自 `DIFFICULTY_TIERS[tier].label` / `.hint`；`use-drill.ts` 的 `createSpecFromChoice` 走 `createDrillSpecForTier(choice.tier, choice.noteCount)`。所以第 2、3 步做完，首页就多了一个按钮——**这正是难度档被抽出来的目的**：加一档只改 core，界面零改动。

要确认它出现，跑 `pnpm dev` 打开 http://localhost:5173 看首页；没出现时先怀疑 Vite 的旧模块缓存，见第 6 步。

## 5. 补测试

文件：`packages/core/tests/exercise.test.ts`。三处：

1. **难度档映射**：`describe('难度档到规格的映射')` 里那条"每一档的音域与跨度规则"加上新档，断言 `createDrillSpecForTier('two-octaves', 3).spanPattern === 'two-octaves'` 且音域是 `DEFAULT_RANGE`。
2. **文案两两不同**：那条"三档的规格文案两两不同"改成按 `DIFFICULTY_TIER_ORDER` 遍历（它已经不假设只有三档），断言 `new Set(labels).size === DIFFICULTY_TIER_ORDER.length`。
3. **出题性质**：`describe('难度档到规格的映射')` 里那条"每一档 × 每种音数都能出题"已经按 `DIFFICULTY_TIER_ORDER` 遍历每种音数各 50 轮，它会自动覆盖新档；再补一条只针对新档的断言，把上界写死：

```ts
it('两个八度内的每一题跨度都不超过 24 个半音，且确实用到了超过一个八度的题', () => {
  const generator = createExerciseGenerator(lcg(909));
  const spec = createDrillSpecForTier('two-octaves', 3);
  let beyondOctave = 0;
  for (let index = 0; index < 200; index += 1) {
    const span = spanOf(generator.generate(spec, `two-${index}`).pitches);
    expect(span).toBeLessThanOrEqual(TWO_OCTAVE_SEMITONES);
    if (span > OCTAVE_SEMITONES) beyondOctave += 1;
  }
  // 只断言上界会被"永远出很窄的题"骗过，所以再要求它确实用满了新允许的范围
  expect(beyondOctave).toBeGreaterThan(50);
});
```

用穷举性质测试而不是单个固定随机源用例，是因为随机出题的正确性体现在分布上：只验证"不超过上界"的实现可能永远只出一个八度内的题，那样这一档就等于白加了。

## 6. Verify

```sh
pnpm typecheck   # 两个包的 tsc 必须干净；漏 key 的 Record 会在这里红
pnpm test        # 新增的映射、文案与跨度断言
pnpm test:docs   # 改了文档之后必跑
pnpm build       # 产出 apps/web/dist
pnpm dev         # http://localhost:5173
```

- `pnpm typecheck` 干净：`SPAN_PATTERN_LABELS`、`DIFFICULTY_TIERS` 都是 `Record<…, …>`，漏一项就红。
- `pnpm test` 通过：新档的跨度 ≤ 24、并且有超过一个八度的题；其余档的断言不受影响。
- 浏览器里点一遍：首页出现「两个八度内」，选「3 个音 + 两个八度内」开始一局，练习页顶部文案应为「第 1 / 10 题 · 3 个音 · 两个八度内」，走完看结算页规格文案也是这个名字。
- 页面没变化时先重启 `pnpm dev` 并删掉 `node_modules/.vite`：改 `packages/core` 源码时 HMR 有时不重新加载该模块，浏览器里跑的还是旧逻辑。
- 核对真实音高只认领域状态，不从 DOM 反推：控制台执行 `window.__yueganRunner.getState().forge`（仅 DEV 构建暴露），`forge[i].pitches` 是第 i 题按播放顺序的真实音高，`Math.max(...pitches) - Math.min(...pitches)` 必须 ≤ 24，`forge[i].correctRanks` 是这道题的正确答案。
