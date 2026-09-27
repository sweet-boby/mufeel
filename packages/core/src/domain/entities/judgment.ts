/**
 * 判分结果（Judgment）：这道题判成什么，以及为什么。
 *
 * v1 的判分口径是「只判方向」：每个音的真实名次都对，才算对（全对/全错）。
 * 明细逐音给出，是为了让反馈能告诉用户「你排错了哪一个」。
 */

import type { Rank, RankSequence } from '../value-objects/rank';
import { countMatches } from '../value-objects/rank';

export interface JudgmentDetail {
  /** 第几个音（按播放顺序，0-based）。 */
  readonly noteIndex: number;
  /** 用户填的档位。 */
  readonly answeredRank: Rank;
  /** 正确档位。 */
  readonly correctRank: Rank;
  readonly isCorrect: boolean;
}

export interface Judgment {
  readonly exerciseId: string;
  readonly isCorrect: boolean;
  /** 排对了几个音，用于反馈文案「5 个里排对 3 个」。 */
  readonly matchedCount: number;
  readonly noteCount: number;
  readonly details: readonly JudgmentDetail[];
}

export function createJudgment(
  exerciseId: string,
  answered: RankSequence,
  correct: RankSequence,
): Judgment {
  const details: JudgmentDetail[] = correct.map((correctRank, noteIndex) => {
    const answeredRank = answered[noteIndex] as Rank;
    return {
      noteIndex,
      answeredRank,
      correctRank,
      isCorrect: answeredRank === correctRank,
    };
  });

  const matchedCount = countMatches(answered, correct);
  return {
    exerciseId,
    isCorrect: matchedCount === correct.length,
    matchedCount,
    noteCount: correct.length,
    details,
  };
}
