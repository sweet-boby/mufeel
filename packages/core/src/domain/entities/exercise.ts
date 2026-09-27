/**
 * 题目（Exercise）：系统播放的一串音，以及由这串音唯一决定的正确排序。
 *
 * 「答案唯一」是本项目的基石：n 个音互不相同，所以把它们升序排列得到的名次
 * 就是唯一正确的档位分配（长度 n 的 1…n 排列）。
 */

import type { Semitones } from '../value-objects/pitch';
import type { RankSequence } from '../value-objects/rank';
import { positionsOf } from '../value-objects/rank';

export interface Exercise {
  /** 题目标识，用于把「一局的第几题」和作答对上。 */
  readonly id: string;
  /** 按播放顺序排列的真实音高。 */
  readonly pitches: readonly Semitones[];
}

/** 题目里有几个音（= 几个滑块 = 几个档位）。 */
export function exerciseNoteCount(exercise: Exercise): number {
  return exercise.pitches.length;
}

/** 唯一正确答案：第 i 个音应该放在第几名。 */
export function correctRanks(exercise: Exercise): RankSequence {
  return positionsOf(exercise.pitches);
}

/**
 * 真实音高的升序排列，用于反馈时展示「标准排序」。
 * 返回的是音高本身而不是名次，这样反馈层可以自己决定显示音名还是位置。
 */
export function sortedPitches(exercise: Exercise): Semitones[] {
  return [...exercise.pitches].sort((a, b) => a - b);
}
