/**
 * 级数（罗马数字）内容表与终止式。
 *
 * 级数把「调内第几个和弦」映射到「根音在哪儿 + 什么性质」：`root` 是主音之上的半音数，
 * `quality` 指向 `content/chords.ts` 的 id（不是字面量的半音排列——那样两处会漂）。
 * 终止式用级数 id 表示，因为它是「哪些和弦、什么顺序」的事实，与怎么发声无关。
 */

import { CHORDS } from './chords';

export interface NumeralContent {
  /** 主音之上的半音数。 */
  readonly root: number;
  /** 指向 `CHORDS` 的 id。 */
  readonly quality: string;
}

export const NUMERALS: Record<string, NumeralContent> = {
  I: { root: 0, quality: 'maj' },
  ii: { root: 2, quality: 'min' },
  iii: { root: 4, quality: 'min' },
  IV: { root: 5, quality: 'maj' },
  V: { root: 7, quality: 'maj' },
  vi: { root: 9, quality: 'min' },
  i: { root: 0, quality: 'min' },
  iv: { root: 5, quality: 'min' },
  VI: { root: 8, quality: 'maj' },
  VII: { root: 10, quality: 'maj' },
};

export const NUMERAL_IDS: readonly string[] = Object.keys(NUMERALS);

/** 功能题先给一个终止式把调性立住。 */
export const CADENCES: Record<string, readonly string[]> = {
  major: ['I', 'IV', 'V', 'I'],
  minor: ['i', 'iv', 'V', 'i'],
};

export type Mode = 'major' | 'minor';

export function numeralContent(id: string): NumeralContent {
  const content = NUMERALS[id];
  if (content === undefined) {
    throw new Error(`未知级数：${id}`);
  }
  return content;
}

/** 级数对应的和弦排列（来自和弦表，不在级数表里再抄一份半音）。 */
export function numeralChordSemitones(id: string): readonly number[] {
  const content = numeralContent(id);
  const chord = CHORDS[content.quality];
  if (chord === undefined) {
    throw new Error(`级数 ${id} 指向了不存在的和弦：${content.quality}`);
  }
  return chord.semitones;
}

export function cadenceNumerals(mode: string): readonly string[] {
  const numerals = CADENCES[mode];
  if (numerals === undefined) {
    throw new Error(`未知调式：${mode}`);
  }
  return numerals;
}
