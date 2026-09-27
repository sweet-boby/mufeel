/**
 * 和弦内容表：id → 最低音之上的半音排列。
 *
 * 排列是字面上的声部：转位就是另一个排列（`maj_1` = 第一转位），
 * 所以「和弦是什么」与「它是怎么排的」在这张表里是同一件事。
 * 名字留在平台侧（i18n），记号（maj7 / m6）跟着表走。
 */

export interface ChordContent {
  /** 从最低音算起的半音偏移，升序、首项为 0。 */
  readonly semitones: readonly number[];
  /** 语言无关的记号。 */
  readonly short: string;
}

export const CHORDS: Record<string, ChordContent> = {
  maj: { semitones: [0, 4, 7], short: 'maj' },
  min: { semitones: [0, 3, 7], short: 'min' },
  dim: { semitones: [0, 3, 6], short: 'dim' },
  aug: { semitones: [0, 4, 8], short: 'aug' },
  sus2: { semitones: [0, 2, 7], short: 'sus2' },
  sus4: { semitones: [0, 5, 7], short: 'sus4' },
  dom7: { semitones: [0, 4, 7, 10], short: '7' },
  maj7: { semitones: [0, 4, 7, 11], short: 'maj7' },
  min7: { semitones: [0, 3, 7, 10], short: 'm7' },
  m7b5: { semitones: [0, 3, 6, 10], short: 'm7♭5' },
  dim7: { semitones: [0, 3, 6, 9], short: 'dim7' },
  mM7: { semitones: [0, 3, 7, 11], short: 'mM7' },
  maj6: { semitones: [0, 4, 7, 9], short: '6' },
  min6: { semitones: [0, 3, 7, 9], short: 'm6' },
  dom9: { semitones: [0, 4, 7, 10, 14], short: '9' },
  maj9: { semitones: [0, 4, 7, 11, 14], short: 'maj9' },
  min9: { semitones: [0, 3, 7, 10, 14], short: 'm9' },
  maj_1: { semitones: [0, 3, 8], short: 'maj/3' },
  maj_2: { semitones: [0, 5, 9], short: 'maj/5' },
  min_1: { semitones: [0, 4, 9], short: 'min/♭3' },
  min_2: { semitones: [0, 5, 8], short: 'min/5' },
};

export const CHORD_IDS: readonly string[] = Object.keys(CHORDS);

export function chordSemitones(id: string): readonly number[] {
  const content = CHORDS[id];
  if (content === undefined) {
    throw new Error(`未知和弦：${id}`);
  }
  return content.semitones;
}
