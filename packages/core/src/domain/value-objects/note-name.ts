/**
 * 音名：人类可读的绝对音高标识，例如 C4 / F#3 / A#5。
 *
 * 音名只在「反馈」阶段出现（告诉用户刚才那个音到底是什么），
 * 答题过程中界面不显示音名，避免用户用读刻度代替听。
 */

import type { Semitones } from './pitch';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** 音名的规范化拼写：一律用升号，字母大写、八度是不带符号的整数。 */
export type NoteName = string;

/**
 * 接受三种写法，一律规范成升号：
 *   C4 / D#4 / Ds4（采样文件名用的就是 Ds 这种拼写）/ Db4（降号，少见但合理）
 */
const NOTE_NAME_PATTERN = /^([A-Ga-g])(#|s|b)?(-?\d+)$/;

/** 音高 → 音名（升号拼写）。 */
export function pitchToNoteName(value: Semitones): NoteName {
  const octave = Math.floor(value / 12) + 4;
  const name = SHARP_NAMES[((value % 12) + 12) % 12];
  return `${name}${octave}`;
}

/** 音名 → 音高；拼写非法时抛错，让数据问题尽早暴露。 */
export function noteNameToPitch(name: NoteName): Semitones {
  const match = NOTE_NAME_PATTERN.exec(name);
  if (match === null) {
    throw new Error(`无法解析的音名: ${name}`);
  }
  const [, letter, accidental, octaveText] = match;
  const letterIndex = SHARP_NAMES.indexOf(letter?.toUpperCase() as (typeof SHARP_NAMES)[number]);
  if (letterIndex < 0) {
    throw new Error(`无法解析的音名: ${name}`);
  }
  // # 与 s 都表示升高半音；b 表示降低半音（用 +11 取模，跨八度不会错）
  const offset = accidental === 'b' ? 11 : accidental === undefined ? 0 : 1;
  return (letterIndex + offset + 12) % 12 + (Number(octaveText) - 4) * 12;
}

/** 音名列表解析；解析失败时抛错并指出是哪一个。 */
export function parseNoteNames(names: readonly NoteName[]): Semitones[] {
  return names.map((name) => noteNameToPitch(name));
}
