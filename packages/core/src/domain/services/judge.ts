/**
 * 判分器（Judge）：领域服务，实现 v1 唯一的判分口径。
 *
 * 口径：「只判方向」——每个音的真实名次都对，整题才算对（全对/全错）。
 * 这条口径刻意不引入容差参数：档位是离散名次，不存在「差一点」的中间状态。
 *
 * 变难的方式已经预留：以后加「音程判断」只需再写一个判分器实现，
 * 作答数据结构（档位序列）不需要改。
 */

import type { Answer } from '../entities/answer';
import type { Exercise } from '../entities/exercise';
import { correctRanks, exerciseNoteCount } from '../entities/exercise';
import type { Judgment } from '../entities/judgment';
import { createJudgment } from '../entities/judgment';
import { isCompleteAssignment, type Rank, type RankSequence } from '../value-objects/rank';

export interface Judge {
  judge(exercise: Exercise, answer: Answer): Judgment;
}

export function createRankOrderJudge(): Judge {
  return {
    judge(exercise: Exercise, answer: Answer): Judgment {
      const noteCount = exerciseNoteCount(exercise);
      const ranks = answer.ranks as RankSequence;

      if (!isCompleteAssignment(ranks, noteCount)) {
        throw new Error(
          `作答必须是 1…${noteCount} 的一个排列，收到 [${answer.ranks.join(', ')}]`,
        );
      }

      return createJudgment(exercise.id, ranks, correctRanks(exercise));
    },
  };
}

/**
 * 把作答映射回「每个音被用户认为在第几名」，用于反馈里显示
 * 「你填：3 / 正确：2 / 真实音高：F4」。
 */
export function formatRank(rank: Rank | null): string {
  return rank === null ? '未选' : `第 ${rank} 位`;
}
