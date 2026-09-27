/**
 * 音高与音高值对象。
 *
 * 领域内所有音高统一用「相对中央 C（C4）的半音数」表示：
 *   C3 = -12，C4 = 0，A4 = 9，C5 = 12
 *
 * 负数索引是刻意的：它让音高天然可排序、可做算术（音程 = 两个音高相减），
 * 而不需要把音名和八度拆成两个字段再分别比较。
 */

/** 相对 C4 的半音数。 */
export type Semitones = number;

/** 项目实际会弹奏的音域。钢琴 88 键是 C1–C7，v1 的练习只用其中一段。 */
export interface PitchRange {
  readonly min: Semitones;
  readonly max: Semitones;
}

/** 相对 C4 的半音数。 */
export function pitch(semitones: Semitones): Semitones {
  return semitones;
}

/** a 到 b 的方向差：正数表示 b 更高。 */
export function semitoneDifference(a: Semitones, b: Semitones): number {
  return b - a;
}

export function isWithinRange(value: Semitones, range: PitchRange): boolean {
  return value >= range.min && value <= range.max;
}

export function clampToRange(value: Semitones, range: PitchRange): Semitones {
  return Math.min(range.max, Math.max(range.min, value));
}

/** 生成 range 内升序的半音序列（含两端），用于出题采样与校验。 */
export function rangeToSemitones(range: PitchRange): Semitones[] {
  const result: Semitones[] = [];
  for (let value = range.min; value <= range.max; value += 1) {
    result.push(value);
  }
  return result;
}
