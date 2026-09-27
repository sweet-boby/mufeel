# 教程：给练习加一个难度档

读者起点与终点：起点是读过 [CONTEXT.md](../../CONTEXT.md) 的术语表、能在本地跑 `pnpm dev` 与 `pnpm test`；终点是 core 里多一档「两个八度内」，Pitch 模块里多一关用它出排序题——这一档的每道题里所有音落在 24 个半音之内，关卡筹码上写着「两个八度内」，并且有测试守住这条性质与它的边界。

例子是加一档"限制跨度为两个八度"的练习。它同时演示两件事：加一档难度要动哪些地方，以及当一档需要**新的跨度规则**时，规则该加在哪个函数里。

## 1. 先想清楚这次改动动的是什么

难度档由两件事一起定义：**出题音域**与**跨度规则**——Web 上用户是通过「进哪一关」来选它的（第 4 步）。这两件事都在 `packages/core/src/domain/entities/drill-spec.ts` 里的难度档表里放着：

```ts
export interface DifficultyTierDefinition {
  readonly label: string;
  readonly hint: string;
  readonly range: PitchRange;
  readonly spanPattern: PitchSpanPattern;
}
```

出题器不认识"难度档"，它只认 `DrillSpec`（音数 + 音域 + 跨度规则 + 题数 + 重听上限）。所以加一档永远是同一套路：**先给规格加一种取值，再给难度档表加一项**。core 侧到此就能出这一档的题；界面里要见到它还差一步——把它安排到课程表的某一关（第 4 步）。

这次要加的是"跨度 ≤ 24 个半音"，也就是一种新的 `PitchSpanPattern` 取值（现有的 `within-octave` 是 ≤ 12，`unrestricted` 是不限制）。

改之前记住这几条不能破坏的不变量（[packages/core/README.md](../../packages/core/README.md) 也列着）：音互不相同答案才唯一；档位数 == 本题音数，正确答案必是 1…n 的排列；一个档位最多被一个滑块占用（`assignRank` 会断言）；题库在开局时就一次性生成并固化（core 的 `start()`），一题之内重听听到的永远是同一组音。这个改动只换取音范围，四条都不受影响。

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

`DIFFICULTY_TIERS` 提供名字与提示（都是 `Record`，漏写一项就是类型错误），`DIFFICULTY_TIER_ORDER` 是 core 侧的遍历顺序，core 的测试按它遍历每一档（加档后自动被覆盖）。`createDrillSpecForTier` 会把这里的 `label` 抄进规格的 `label` 字段，`describeDrillSpec` 与 core 自己的文案用它——规格自带名字，而不是回头从音域与跨度规则反推，因为 `standard` 与 `wide` 的跨度规则相同、只有音域不同，反推出来的名字必然对不上。

注意 Web 界面显示的不是这个 `label`：关卡筹码上的档位名走 i18n 的 `tier.standard` / `tier.octave` / `tier.wide`（第 4 步）。core 的 `label` 与 `hint` 目前只有 core 自己和将来的平台端会用。

## 4. 在课程表里安排一关，并补上两份字典的文案

core 侧加完档，界面上还看不到它：**Web 端没有难度按钮，难度档是 Pitch 模块排序关卡的属性**。关卡表在 `apps/web/src/course/curriculum.ts`，`rankLevel(id, noteCount, tier)` 把关卡 id、音数与档位捆在一起——把它插进 `pitch` 模块的 `levels` 数组，这一档就在课程里有了位置：

```ts
rankLevel('order4TwoOctaves', 4, 'two-octaves'),
```

插在哪一关要留意：解锁默认按下标顺序走（第 n 关要第 n−1 关完成，入门路径可以预解锁若干关），存档也按「模块:关卡下标」记（`apps/web/src/infrastructure/progress.ts`），插在中间会让后面几关的存档整体挪位；想稳妥就追加在排序关卡那一段的末尾。

关卡的显示名走 i18n，不走 core 的 `label`。`rankLevel` 生成的 `nameKey` / `hintKey` 形如 `module.pitch.level.<id>.name` / `.hint`，两份字典 `apps/web/src/i18n/zh.ts` 与 `apps/web/src/i18n/en.ts` 都要补上；另外还要补一条档位显示名 `tier.two-octaves`——模块页的关卡筹码按 `tier.` 前缀加档位名拼出这个 key 去取它（课程表里的 `kind: 'rank'` 分支）。

跑 `pnpm test`：`apps/web/src/i18n/i18n.test.ts` 是门禁，它检查两份字典的 key 完全一致、课程表里每个 `*Key` 都存在，只补一份字典会红。但 `tier.${level.tier}` 是拼出来的 key，门禁扫不到它：漏了这条不会报错，界面会直接把 key 当文案显示（筹码上写着 `tier.two-octaves` 就是漏了），所以要自己盯一眼。

要确认它出现，跑 `pnpm dev` 打开 http://localhost:5173，进「音高」模块看关卡列表；没出现时先怀疑 Vite 的旧模块缓存，见第 6 步。

## 5. 补测试

文件：`packages/core/tests/exercise.test.ts`。三处：

1. **难度档映射**：`describe('难度档到规格的映射')` 里那条"每一档的音域与跨度规则"加上新档，断言 `createDrillSpecForTier('two-octaves', 3).spanPattern === 'two-octaves'` 且音域是 `DEFAULT_RANGE`。
2. **文案一致**：那条"规格文案由难度档自己的名字产出"已经按 `DIFFICULTY_TIER_ORDER` 遍历（不假设档数），它断言两件事——每档文案两两不同（否则历史记录里两局无法区分），且规格文案必须包含该档自己的 `label`（档位定义与规格文案不能两写）。新档加进 `DIFFICULTY_TIER_ORDER` 后这两点自动被覆盖。这条只管 core 的 `label`；界面上显示的名字是另一条线（第 4 步的 i18n 字典），要自己确认两边说的是同一档。
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
pnpm test        # 新增的映射、文案与跨度断言，外加 i18n 门禁
pnpm test:docs   # 改了文档之后必跑
pnpm build       # 产出 apps/web/dist
pnpm dev         # http://localhost:5173
```

- `pnpm typecheck` 干净：`SPAN_PATTERN_LABELS`、`DIFFICULTY_TIERS` 都是 `Record<…, …>`，漏一项就红。
- `pnpm test` 通过：新档的跨度 ≤ 24、并且有超过一个八度的题；i18n 门禁检查两份字典一致；其余档的断言不受影响。
- 浏览器里点一遍：进「音高」模块，关卡列表里出现新关卡，筹码是「3 个音」+「两个八度内」；点进去后练习页顶部是「第 N 关 · 关卡名」——关卡是开放式练习，没有固定题数，达到这一关的目标（最近 window 题里对 need 题）就弹庆祝，之后仍可继续练。听几题确认跨度不超过两个八度。
- 页面没变化时先重启 `pnpm dev` 并删掉 `node_modules/.vite`：改 `packages/core` 源码时 HMR 有时不重新加载该模块，浏览器里跑的还是旧逻辑。
- 核对真实音高只认领域状态，不从 DOM 反推：控制台执行 `window.__yueganSession.truth()`（仅 DEV 构建暴露），它给出当前这道排序题的 `{ pitches, correct }`——`pitches` 是按播放顺序的真实音高，`Math.max(...pitches) - Math.min(...pitches)` 必须 ≤ 24，`correct` 是这道题的正确排序（升序的档位序列）。
