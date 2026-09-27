/**
 * 音阶内容表：id → 一个八度内的半音排列（含高八度的主音，所以末项恒为 12）。
 *
 * 「有哪些音阶」是音乐事实，因此住在 core；音阶的**名字**（大调 / Dorian / 半全）
 * 与副标题留在平台侧（i18n），core 不出现任何面向用户的词。
 */

export interface ScaleContent {
  /** 从主音算起的半音偏移，升序、首项 0、末项 12。 */
  readonly semitones: readonly number[];
}

export const SCALES: Record<string, ScaleContent> = {
  major: { semitones: [0, 2, 4, 5, 7, 9, 11, 12] },
  natmin: { semitones: [0, 2, 3, 5, 7, 8, 10, 12] },
  harmmin: { semitones: [0, 2, 3, 5, 7, 8, 11, 12] },
  melmin: { semitones: [0, 2, 3, 5, 7, 9, 11, 12] },
  majpent: { semitones: [0, 2, 4, 7, 9, 12] },
  minpent: { semitones: [0, 3, 5, 7, 10, 12] },
  blues: { semitones: [0, 3, 5, 6, 7, 10, 12] },
  dorian: { semitones: [0, 2, 3, 5, 7, 9, 10, 12] },
  phrygian: { semitones: [0, 1, 3, 5, 7, 8, 10, 12] },
  lydian: { semitones: [0, 2, 4, 6, 7, 9, 11, 12] },
  mixolydian: { semitones: [0, 2, 4, 5, 7, 9, 10, 12] },
  locrian: { semitones: [0, 1, 3, 5, 6, 8, 10, 12] },
  wholetone: { semitones: [0, 2, 4, 6, 8, 10, 12] },
  dimhw: { semitones: [0, 1, 3, 4, 6, 7, 9, 10, 12] },
  phrygdom: { semitones: [0, 1, 4, 5, 7, 8, 10, 12] },
};

export const SCALE_IDS: readonly string[] = Object.keys(SCALES);

export function scaleSemitones(id: string): readonly number[] {
  const content = SCALES[id];
  if (content === undefined) {
    throw new Error(`未知音阶：${id}`);
  }
  return content.semitones;
}
