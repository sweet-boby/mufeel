/**
 * 练习规格（DrillSpec）：一局练习在开始前就固定下来的形状。
 *
 * 「3 个音、八度内」就是一个规格；一局里的 10 道题都遵守同一个规格。
 * 规格是难度唯一的外在表达——音数决定几个滑块，音域跨度决定难不难听出来。
 */

import type { PitchRange } from '../value-objects/pitch';

/** 一局练习出多少道题。 */
export const DEFAULT_EXERCISE_COUNT = 10;

/** 每题允许用户主动重听几次（首次播放不算重听）。 */
export const DEFAULT_REPLAY_LIMIT = 3;

/** 音域跨度的两种难度：整题所有音落在同一个八度内，或不限制。 */
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

export const DEFAULT_RANGE: PitchRange = { min: -12, max: 12 }; // C3 – C5

export const MIN_NOTE_COUNT = 2;
export const MAX_NOTE_COUNT = 5;

export const SPAN_PATTERN_LABELS: Record<PitchSpanPattern, string> = {
  'within-octave': '八度内',
  unrestricted: '全音域',
};

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

/** 人话描述一个规格，例如「3 个音 · 八度内」。 */
export function describeDrillSpec(spec: DrillSpec): string {
  return `${spec.noteCount} 个音 · ${SPAN_PATTERN_LABELS[spec.spanPattern]}`;
}

/** 整题跨度上限；unrestricted 时返回整个音域的宽度。 */
export function maxSpanOf(spec: DrillSpec): number {
  if (spec.spanPattern === 'within-octave') {
    return OCTAVE_SEMITONES;
  }
  return spec.range.max - spec.range.min;
}
