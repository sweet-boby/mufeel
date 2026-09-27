/**
 * 旋律听写的出题规则：给定一关允许的音级，规划一条长度固定的旋律。
 *
 * 这是纯算法 + 随机源，因此住在 core；平台侧只负责把它变成播放事件与键盘范围。
 * 「允许哪些音」由调用方（课程表）给出，本文件不读任何课程或关卡数据。
 *
 * 三条规则：
 *   1. 只允许出现在 `degrees` 里的音级；`upperDo` 打开时额外允许高八度的主音；
 *   2. 起步音落在主音（长句可以在主和弦音里挑），避免一上来就飘；
 *   3. 级进为主，`leapy` 时放开到四度以内的跳进；`chromatic` 给一个概率，把某个音
 *      临时升高或降低半音（仍夹在本关音域内，且不与已有音级重复）。
 */

import { DEGREES } from '../content/degrees';
import { pickOne, weightedPick, type RandomSource } from '../ports/random-source';

export interface MelodyPlanOptions {
  readonly keyRoot: number;
  /** 允许出现的音级 id（见 `content/degrees.ts`）。 */
  readonly degrees: readonly string[];
  /** 音数。 */
  readonly length: number;
  /** 额外允许高八度的主音。 */
  readonly upperDo?: boolean;
  /** 放开到四度以内的跳进，而不是只走级进。 */
  readonly leapy?: boolean;
  /** 单个音变半音的概率（0..1）。 */
  readonly chromatic?: number;
}

export interface MelodyPlan {
  readonly pitches: readonly number[];
  /** 本关允许的全部音高（升序），平台侧用它算键盘范围。 */
  readonly allowed: readonly number[];
}

const STEP_WEIGHTS_STEPWISE: readonly (readonly [number, number])[] = [
  [-2, 1],
  [-1, 3.5],
  [1, 3.5],
  [2, 1],
];

const STEP_WEIGHTS_LEAPY: readonly (readonly [number, number])[] = [
  [-4, 1],
  [-3, 1.5],
  [-2, 2],
  [-1, 3],
  [1, 3],
  [2, 2],
  [3, 1.5],
  [4, 1],
];

/** 本关允许的音高（升序）。 */
export function allowedMelodyPitches(options: MelodyPlanOptions): number[] {
  const pitches = options.degrees.map((id) => {
    const degree = DEGREES[id];
    if (degree === undefined) {
      throw new Error(`未知音级：${id}`);
    }
    return options.keyRoot + degree.semitones;
  });
  if (options.upperDo === true) {
    pitches.push(options.keyRoot + 12);
  }
  return pitches.sort((a, b) => a - b);
}

export function planMelody(options: MelodyPlanOptions, random: RandomSource): MelodyPlan {
  if (options.length < 1) {
    throw new Error(`旋律至少要有 1 个音，收到 ${options.length}`);
  }
  const allowed = allowedMelodyPitches(options);
  const top = allowed[allowed.length - 1] as number;

  const startPool =
    options.length <= 4
      ? [options.keyRoot]
      : [options.keyRoot, options.keyRoot + 4, options.keyRoot + 7].filter((pitch) =>
          allowed.includes(pitch),
        );
  let index = allowed.indexOf(startPool.length > 0 ? pickOne(startPool, random) : options.keyRoot);
  if (index < 0) {
    index = 0;
  }

  const steps = options.leapy === true ? STEP_WEIGHTS_LEAPY : STEP_WEIGHTS_STEPWISE;
  const pitches: number[] = [allowed[index] as number];

  for (let position = 1; position < options.length; position += 1) {
    const moves = steps.filter(([step]) => index + step >= 0 && index + step < allowed.length);
    if (moves.length === 0) {
      throw new Error('音级太少，走不出下一步');
    }
    const [step] = weightedPick(
      moves,
      moves.map(([, weight]) => weight),
      random,
    );
    index += step;
    let pitch = allowed[index] as number;

    const chromatic = options.chromatic ?? 0;
    if (chromatic > 0 && random.next() < chromatic && position < options.length - 1) {
      const alternative = pitch + (random.next() < 0.5 ? -1 : 1);
      if (
        alternative > options.keyRoot - 1 &&
        alternative < top + 1 &&
        !allowed.includes(alternative)
      ) {
        pitch = alternative;
      }
    }
    pitches.push(pitch);
  }

  return { pitches, allowed };
}
