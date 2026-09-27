/**
 * 练习规格（DrillSpec）：一局练习在开始前就固定下来的形状。
 *
 * 「3 个音、八度内」就是一个规格；一局里的 10 道题都遵守同一个规格。
 * 规格是难度唯一的外在表达——音数决定几个滑块，出题音域与跨度规则决定难不难听出来。
 *
 * 界面上的"难度档"（DifficultyTier）是给人挑的入口，它映射到一个规格里的
 * 「音域 + 跨度规则」两项；规格本身仍是出题器唯一认的东西。
 */

import { pitchToNoteName } from '../value-objects/note-name';
import type { PitchRange } from '../value-objects/pitch';

/** 一局练习出多少道题。 */
export const DEFAULT_EXERCISE_COUNT = 10;

/** 每题允许用户主动重听几次（首次播放不算重听）。 */
export const DEFAULT_REPLAY_LIMIT = 3;

/** 跨度规则：整题所有音落在同一个八度内，或不限制。 */
export type PitchSpanPattern = 'within-octave' | 'unrestricted';

/** 一个八度 = 12 个半音。 */
export const OCTAVE_SEMITONES = 12;

export interface DrillSpec {
  /** 每题弹几个音，也就是每题几个滑块、几个档位。 */
  readonly noteCount: number;
  /** 音域跨度模式。 */
  readonly spanPattern: PitchSpanPattern;
  /** 出题允许使用的音域。 */
  readonly range: PitchRange;
  /** 一局的题数。 */
  readonly exerciseCount: number;
  /** 每题允许重听几次。 */
  readonly replayLimit: number;
}

/**
 * 两个音域：
 * - `DEFAULT_RANGE` 是练习常用的中音区，八度内与全音域两档都用它。
 * - `WIDE_RANGE` 覆盖钢琴的大部分键盘。它等于采样集覆盖的完整范围（C1–A7），
 *   因此这一档里的每个音高都能用最近的采样发声，变调不超过 1 个半音；
 *   再往外（A0–B0、A#7–C8）就需要补采样，见 docs/extension-cookbook.md。
 */
export const DEFAULT_RANGE: PitchRange = { min: -12, max: 12 }; // C3 – C5
export const WIDE_RANGE: PitchRange = { min: -36, max: 45 }; // C1 – A7

export const MIN_NOTE_COUNT = 2;
export const MAX_NOTE_COUNT = 5;

/**
 * 难度档：界面上的一个按钮 = 一个难度档。
 *
 * 它同时决定音域与跨度规则，因为这两者一起才构成"难不难"：
 * `standard` 在中音区里随便散，`octave` 把音挤进一个八度，`wide` 把音域拉到整个键盘。
 */
export type DifficultyTier = 'standard' | 'octave' | 'wide';

export interface DifficultyTierDefinition {
  readonly label: string;
  /** 选中这一档时展示的说明。 */
  readonly hint: string;
  readonly range: PitchRange;
  readonly spanPattern: PitchSpanPattern;
}

export const DIFFICULTY_TIERS: Record<DifficultyTier, DifficultyTierDefinition> = {
  standard: {
    label: '全音域',
    hint: '音可以散布在整个音域里，跨度不限',
    range: DEFAULT_RANGE,
    spanPattern: 'unrestricted',
  },
  octave: {
    label: '八度内',
    hint: '所有音挤在同一个八度里，更难分辨',
    range: DEFAULT_RANGE,
    spanPattern: 'within-octave',
  },
  wide: {
    label: '宽音域',
    hint: '音域拉到 C1–A7，音的分布更接近真实钢琴',
    range: WIDE_RANGE,
    spanPattern: 'unrestricted',
  },
};

/** 界面上难度按钮的出现顺序：中音区两档（先松后紧），最后一档把音域拉到整个键盘。 */
export const DIFFICULTY_TIER_ORDER: readonly DifficultyTier[] = ['standard', 'wide', 'octave'];

/** 跨度规则的显示名，用于规格文案。 */
export const SPAN_PATTERN_LABELS: Record<PitchSpanPattern, string> = {
  'within-octave': '八度内',
  unrestricted: '全音域',
};

/**
 * 由难度档与音数得到一个完整规格。
 *
 * 注意：`wide` 档的音域与 `standard` 的跨度规则组合出的是"整个键盘里随便散"，
 * 这正是这一档的意图；`octave` 档仍然是真的一个八度，只是它可能落在键盘的任意位置。
 */
export function createDrillSpecForTier(
  tier: DifficultyTier,
  noteCount: number,
  overrides: Partial<Omit<DrillSpec, 'range' | 'spanPattern' | 'noteCount'>> = {},
): DrillSpec {
  const definition = DIFFICULTY_TIERS[tier];
  return {
    noteCount,
    spanPattern: definition.spanPattern,
    range: definition.range,
    exerciseCount: DEFAULT_EXERCISE_COUNT,
    replayLimit: DEFAULT_REPLAY_LIMIT,
    ...overrides,
  };
}

export function createDrillSpec(
  overrides: Partial<DrillSpec> & Pick<DrillSpec, 'noteCount' | 'spanPattern'>,
): DrillSpec {
  return {
    range: DEFAULT_RANGE,
    exerciseCount: DEFAULT_EXERCISE_COUNT,
    replayLimit: DEFAULT_REPLAY_LIMIT,
    ...overrides,
  };
}

/** 音域文案，例如「C3–C5」。 */
export function describeRange(range: PitchRange): string {
  return `${pitchToNoteName(range.min)}–${pitchToNoteName(range.max)}`;
}

/**
 * 人话描述一个规格，例如「3 个音 · 八度内」。
 *
 * 跨度规则不足以区分两档"音域不同、跨度都不限"的练习（中音区的全音域 vs C1–A7 的宽音域），
 * 所以不限制跨度的规格会带上实际音域；八度内自带明确约束，不必再报范围。
 */
export function describeDrillSpec(spec: DrillSpec): string {
  const span = SPAN_PATTERN_LABELS[spec.spanPattern];
  return spec.spanPattern === 'within-octave'
    ? `${spec.noteCount} 个音 · ${span}`
    : `${spec.noteCount} 个音 · ${span}（${describeRange(spec.range)}）`;
}

/** 整题跨度上限；unrestricted 时返回整个音域的宽度。 */
export function maxSpanOf(spec: DrillSpec): number {
  if (spec.spanPattern === 'within-octave') {
    return OCTAVE_SEMITONES;
  }
  return spec.range.max - spec.range.min;
}
