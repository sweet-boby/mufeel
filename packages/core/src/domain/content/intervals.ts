/**
 * 音程内容表：id → 半音数。
 *
 * 放在 content/ 而不是 value-objects/：value-objects 放的是「音高怎么算」的原语
 * （`intervalBetween` / `spanOf`），这里放的是「有哪些音程」这份**音乐事实**。
 * 它平台无关、与语言无关，因此属于 core；名字与参考曲目留在平台侧（Web 走 i18n）。
 *
 * `short` 是记号（m2 / P5 / maj7 这类），不是文案：中英文里都这么写，所以跟着表走。
 */

export interface IntervalContent {
  /** 两个音相差的半音数（复音程超过 12）。 */
  readonly semitones: number;
  /** 语言无关的记号。 */
  readonly short: string;
}

export const INTERVALS: Record<string, IntervalContent> = {
  m2: { semitones: 1, short: 'm2' },
  M2: { semitones: 2, short: 'M2' },
  m3: { semitones: 3, short: 'm3' },
  M3: { semitones: 4, short: 'M3' },
  P4: { semitones: 5, short: 'P4' },
  TT: { semitones: 6, short: 'TT' },
  P5: { semitones: 7, short: 'P5' },
  m6: { semitones: 8, short: 'm6' },
  M6: { semitones: 9, short: 'M6' },
  m7: { semitones: 10, short: 'm7' },
  M7: { semitones: 11, short: 'M7' },
  P8: { semitones: 12, short: 'P8' },
  m9: { semitones: 13, short: 'm9' },
  M9: { semitones: 14, short: 'M9' },
  P11: { semitones: 17, short: 'P11' },
  P12: { semitones: 19, short: 'P12' },
};

export const INTERVAL_IDS: readonly string[] = Object.keys(INTERVALS);

/** 取音程的半音数；id 不存在时抛错，让数据问题尽早暴露。 */
export function intervalSemitones(id: string): number {
  const content = INTERVALS[id];
  if (content === undefined) {
    throw new Error(`未知音程：${id}`);
  }
  return content.semitones;
}
