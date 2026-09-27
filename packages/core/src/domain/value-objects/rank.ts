/**
 * 档位（Rank）：答题时一个滑块可以选择的「相对音高位置」。
 *
 * 关键约定：档位数 == 这一题的音数 n，取值范围是 1…n。
 * 1 表示「这一题里最低的那个音」，n 表示「最高的那个音」。
 * 因此档位不是绝对音高，它只在同一道题内部有意义。
 */

import type { Semitones } from './pitch';

/** 档位序数，1-based。 */
export type Rank = number;

/** 升序排序后的名次序列：ranks[i] = 第 i 个音（按播放顺序）排第几。 */
export type RankSequence = readonly Rank[];

/** 第 i 个音的真实名次，就是它升序排序后的位置（1-based）。 */
export function positionsOf(pitches: readonly Semitones[]): RankSequence {
  return pitches.map((value) => 1 + pitches.filter((other) => other < value).length);
}

/** 1…n 的一个排列。 */
export function ranksFor(noteCount: number): Rank[] {
  return Array.from({ length: noteCount }, (_, index) => index + 1);
}

/** 是否恰好是 1…n 的一个排列（每个档位各用一次，不重不漏）。 */
export function isCompleteAssignment(assignment: RankSequence, noteCount: number): boolean {
  if (assignment.length !== noteCount) {
    return false;
  }
  const seen = new Set<Rank>();
  for (const rank of assignment) {
    if (!Number.isInteger(rank) || rank < 1 || rank > noteCount) {
      return false;
    }
    if (seen.has(rank)) {
      return false;
    }
    seen.add(rank);
  }
  return seen.size === noteCount;
}

/** 与正确答案相比，逐个音对上了几个（用于反馈文案，不参与判分）。 */
export function countMatches(assignment: RankSequence, correct: RankSequence): number {
  let count = 0;
  for (let index = 0; index < correct.length; index += 1) {
    if (assignment[index] === correct[index]) {
      count += 1;
    }
  }
  return count;
}

/**
 * 指针落点（proposal）：用户把滑块拖到某个位置、但还没确认时，界面上可以显示
 * 「你就停在这一档」，而领域状态仍然算「未选择」。
 *
 * 这一层之所以必须存在：原生 range 控件没有「空值」，它的默认值永远是第一档。
 * 如果不区分「拖动位置」和「已选档位」，一个没动过的滑块看起来就像已经答了第一档，
 * 而提交时又会被判为未作答——用户会觉得按钮坏了。
 */
export type RankProposal = Rank;

