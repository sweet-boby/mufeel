/**
 * 作答（Answer）：用户把每个滑块拖到哪个档位。
 *
 * 存的是档位序列而不是音高序列——用户操作的本来就是「第几位」，
 * 存音高会引入「档位 ↔ 音高」两种互相矛盾的表示。
 */

import type { Rank, RankSequence } from '../value-objects/rank';
import { isCompleteAssignment } from '../value-objects/rank';
import type { Exercise } from './exercise';
import { exerciseNoteCount } from './exercise';

export interface Answer {
  readonly exerciseId: string;
  /** 按题目播放顺序：第 i 个音被用户放在了第几档。未选择时为 null。 */
  readonly ranks: readonly (Rank | null)[];
}

export type AnswerDraft = readonly (Rank | null)[];

export function createAnswerDraft(noteCount: number): AnswerDraft {
  return Array.from({ length: noteCount }, () => null);
}

export function setRankAt(draft: AnswerDraft, noteIndex: number, rank: Rank | null): AnswerDraft {
  return draft.map((value, index) => (index === noteIndex ? rank : value));
}

/**
 * 在 1…n 的档位里，找出「除第 noteIndex 个音之外」已经被占用的档位。
 * 界面用它来禁用重复选择，从交互上避免提交一个必错的答案。
 */
export function ranksTakenByOthers(
  draft: AnswerDraft,
  noteIndex: number,
): ReadonlySet<Rank> {
  const taken = new Set<Rank>();
  draft.forEach((value, index) => {
    if (index !== noteIndex && value !== null) {
      taken.add(value);
    }
  });
  return taken;
}

/** 草稿能否提交：每个音都选了档位，且档位互不重复。 */
export function isDraftSubmittable(draft: AnswerDraft, noteCount: number): boolean {
  if (draft.some((value) => value === null)) {
    return false;
  }
  return isCompleteAssignment(draft as RankSequence, noteCount);
}

export function submitDraft(exercise: Exercise, draft: AnswerDraft): Answer {
  const noteCount = exerciseNoteCount(exercise);
  if (!isDraftSubmittable(draft, noteCount)) {
    throw new Error('作答未完成或存在重复档位，不能提交');
  }
  return { exerciseId: exercise.id, ranks: draft as RankSequence };
}

/**
 * 把某个滑块放到某一档，并处理「该档位已被别的滑块占用」的情况。
 *
 * 语义（产品已确认）：
 *   - 抢占者原本已有档位 → 两人互换；
 *   - 抢占者原本没有作答 → 被抢的人变成未作答。
 * 无论哪条，都保证「一个档位最多被一个滑块占用」这个不变量，
 * 否则界面上会出现两个滑块指向同一位、而用户完全无法察觉。
 */
export function assignRank(draft: AnswerDraft, noteIndex: number, rank: Rank): AnswerDraft {
  const takenByIndex = draft.findIndex((value, at) => at !== noteIndex && value === rank);
  const displaced = draft[noteIndex] ?? null;
  let next = setRankAt(draft, noteIndex, rank);
  if (takenByIndex >= 0) {
    // 抢占者原本没作答时，被抢的人就变成未作答，而不是复制一份重复档位。
    next = setRankAt(next, takenByIndex, displaced);
  }
  assertNoDuplicateRanks(next);
  return next;
}

/** 不变量：同一个档位不能被两个滑块同时占用。 */
export function assertNoDuplicateRanks(draft: AnswerDraft): void {
  const seen = new Set<Rank>();
  for (const value of draft) {
    if (value === null) {
      continue;
    }
    if (seen.has(value)) {
      throw new Error(`档位 ${value} 被多个滑块同时占用：${JSON.stringify(draft)}`);
    }
    seen.add(value);
  }
}
