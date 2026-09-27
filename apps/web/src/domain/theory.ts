/**
 * 乐理数据层（应用层的领域常量，不是 UI）。
 *
 * 这一层只放「音乐是什么」的静态事实：音程/和弦/音阶/音级/级数的半音结构、
 * 参考曲目、以及选音用的随机工具。它不含任何 DOM 与 React 依赖，
 * 与 earpath-app 的 js/theory.js 一一对应，改动时保持数据可比。
 *
 * 所有面向用户的**名字**都存成 i18n key（`nameKey`），由界面按当前语言翻译；
 * 只有与语言无关的记号（`m2` / `maj7` / `Do`）才直接写字面量。
 */

import type { Semitones } from '@yuegan/core';

// ── 音高与音名 ────────────────────────────────────────────────────────────────

export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** 界面里的音名用 ♯ / ♭ 拼写；core 内部用 # / b，两者只在展示层不同。 */
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const midiName = (m: number): string =>
  `${NOTE_NAMES[((m % 12) + 12) % 12] ?? 'C'}${Math.floor(m / 12) - 1}`;

/**
 * core 的音高（C4 = 0）与 MIDI（C4 = 60）之间的换算。
 *
 * 排序题的全部规则都跑在 core 的「半音数」坐标系里，而 earpath 侧的题型（音程/和弦/
 * 音阶/级数/旋律）用的是 MIDI 号；两套坐标只在出题与播放的边界上换算，界面不参与。
 */
export const MIDI_MIDDLE_C = 60;
export const midiFromPitch = (pitch: Semitones): number => pitch + MIDI_MIDDLE_C;
export const pitchFromMidi = (midi: number): Semitones => midi - MIDI_MIDDLE_C;

// ── 音程 ──────────────────────────────────────────────────────────────────────

export interface IntervalDef {
  readonly semis: number;
  readonly nameKey: string;
  /** 语言无关的缩写，直接显示在选项与筹码上。 */
  readonly short: string;
  readonly songKeys?: { readonly asc?: string; readonly desc?: string };
}

export const INTERVALS: Record<string, IntervalDef> = {
  m2: { semis: 1, nameKey: 'theory.interval.m2', short: 'm2', songKeys: { asc: 'song.jaws', desc: 'song.furElise' } },
  M2: { semis: 2, nameKey: 'theory.interval.M2', short: 'M2', songKeys: { asc: 'song.happyBirthday', desc: 'song.maryLamb' } },
  m3: { semis: 3, nameKey: 'theory.interval.m3', short: 'm3', songKeys: { asc: 'song.greensleeves', desc: 'song.heyJude' } },
  M3: { semis: 4, nameKey: 'theory.interval.M3', short: 'M3', songKeys: { asc: 'song.saints', desc: 'song.swingLow' } },
  P4: { semis: 5, nameKey: 'theory.interval.P4', short: 'P4', songKeys: { asc: 'song.bridal', desc: 'song.eineKleine' } },
  TT: { semis: 6, nameKey: 'theory.interval.TT', short: 'TT', songKeys: { asc: 'song.simpsons', desc: 'song.evenFlow' } },
  P5: { semis: 7, nameKey: 'theory.interval.P5', short: 'P5', songKeys: { asc: 'song.starWars', desc: 'song.flintstones' } },
  m6: { semis: 8, nameKey: 'theory.interval.m6', short: 'm6', songKeys: { asc: 'song.entertainer', desc: 'song.loveStory' } },
  M6: { semis: 9, nameKey: 'theory.interval.M6', short: 'M6', songKeys: { asc: 'song.myBonnie', desc: 'song.nobodyKnows' } },
  m7: { semis: 10, nameKey: 'theory.interval.m7', short: 'm7', songKeys: { asc: 'song.somewhere', desc: 'song.watermelonMan' } },
  M7: { semis: 11, nameKey: 'theory.interval.M7', short: 'M7', songKeys: { asc: 'song.takeOnMe', desc: 'song.iLoveYou' } },
  P8: { semis: 12, nameKey: 'theory.interval.P8', short: 'P8', songKeys: { asc: 'song.rainbow', desc: 'song.willowWeep' } },
  m9: { semis: 13, nameKey: 'theory.interval.m9', short: 'm9' },
  M9: { semis: 14, nameKey: 'theory.interval.M9', short: 'M9' },
  P11: { semis: 17, nameKey: 'theory.interval.P11', short: 'P11' },
  P12: { semis: 19, nameKey: 'theory.interval.P12', short: 'P12' },
};

export const DIRECTIONS: Record<string, { nameKey: string; symbol: string }> = {
  a: { nameKey: 'theory.direction.a', symbol: '↑' },
  d: { nameKey: 'theory.direction.d', symbol: '↓' },
  h: { nameKey: 'theory.direction.h', symbol: '⇈' },
};

// ── 和弦 ──────────────────────────────────────────────────────────────────────
// semis 是最低音之上的半音偏移，所以转位就是字面上的排列。

export interface ChordDef {
  readonly semis: readonly number[];
  readonly nameKey: string;
  readonly short: string;
}

export const CHORDS: Record<string, ChordDef> = {
  maj: { semis: [0, 4, 7], nameKey: 'theory.chord.maj', short: 'maj' },
  min: { semis: [0, 3, 7], nameKey: 'theory.chord.min', short: 'min' },
  dim: { semis: [0, 3, 6], nameKey: 'theory.chord.dim', short: 'dim' },
  aug: { semis: [0, 4, 8], nameKey: 'theory.chord.aug', short: 'aug' },
  sus2: { semis: [0, 2, 7], nameKey: 'theory.chord.sus2', short: 'sus2' },
  sus4: { semis: [0, 5, 7], nameKey: 'theory.chord.sus4', short: 'sus4' },
  dom7: { semis: [0, 4, 7, 10], nameKey: 'theory.chord.dom7', short: '7' },
  maj7: { semis: [0, 4, 7, 11], nameKey: 'theory.chord.maj7', short: 'maj7' },
  min7: { semis: [0, 3, 7, 10], nameKey: 'theory.chord.min7', short: 'm7' },
  m7b5: { semis: [0, 3, 6, 10], nameKey: 'theory.chord.m7b5', short: 'm7♭5' },
  dim7: { semis: [0, 3, 6, 9], nameKey: 'theory.chord.dim7', short: 'dim7' },
  mM7: { semis: [0, 3, 7, 11], nameKey: 'theory.chord.mM7', short: 'mM7' },
  maj6: { semis: [0, 4, 7, 9], nameKey: 'theory.chord.maj6', short: '6' },
  min6: { semis: [0, 3, 7, 9], nameKey: 'theory.chord.min6', short: 'm6' },
  dom9: { semis: [0, 4, 7, 10, 14], nameKey: 'theory.chord.dom9', short: '9' },
  maj9: { semis: [0, 4, 7, 11, 14], nameKey: 'theory.chord.maj9', short: 'maj9' },
  min9: { semis: [0, 3, 7, 10, 14], nameKey: 'theory.chord.min9', short: 'm9' },
  maj_1: { semis: [0, 3, 8], nameKey: 'theory.chord.majInv1', short: 'maj/3' },
  maj_2: { semis: [0, 5, 9], nameKey: 'theory.chord.majInv2', short: 'maj/5' },
  min_1: { semis: [0, 4, 9], nameKey: 'theory.chord.minInv1', short: 'min/♭3' },
  min_2: { semis: [0, 5, 8], nameKey: 'theory.chord.minInv2', short: 'min/5' },
};

// ── 音阶 ──────────────────────────────────────────────────────────────────────

export interface ScaleDef {
  readonly semis: readonly number[];
  readonly nameKey: string;
  /** 副标题（Ionian / ascending / half-whole 之类），也是 i18n key。 */
  readonly subKey?: string;
}

export const SCALES: Record<string, ScaleDef> = {
  major: { semis: [0, 2, 4, 5, 7, 9, 11, 12], nameKey: 'theory.scale.major', subKey: 'theory.scale.sub.ionian' },
  natmin: { semis: [0, 2, 3, 5, 7, 8, 10, 12], nameKey: 'theory.scale.natmin', subKey: 'theory.scale.sub.aeolian' },
  harmmin: { semis: [0, 2, 3, 5, 7, 8, 11, 12], nameKey: 'theory.scale.harmmin' },
  melmin: { semis: [0, 2, 3, 5, 7, 9, 11, 12], nameKey: 'theory.scale.melmin', subKey: 'theory.scale.sub.ascending' },
  majpent: { semis: [0, 2, 4, 7, 9, 12], nameKey: 'theory.scale.majpent' },
  minpent: { semis: [0, 3, 5, 7, 10, 12], nameKey: 'theory.scale.minpent' },
  blues: { semis: [0, 3, 5, 6, 7, 10, 12], nameKey: 'theory.scale.blues' },
  dorian: { semis: [0, 2, 3, 5, 7, 9, 10, 12], nameKey: 'theory.scale.dorian' },
  phrygian: { semis: [0, 1, 3, 5, 7, 8, 10, 12], nameKey: 'theory.scale.phrygian' },
  lydian: { semis: [0, 2, 4, 6, 7, 9, 11, 12], nameKey: 'theory.scale.lydian' },
  mixolydian: { semis: [0, 2, 4, 5, 7, 9, 10, 12], nameKey: 'theory.scale.mixolydian' },
  locrian: { semis: [0, 1, 3, 5, 6, 8, 10, 12], nameKey: 'theory.scale.locrian' },
  wholetone: { semis: [0, 2, 4, 6, 8, 10, 12], nameKey: 'theory.scale.wholetone' },
  dimhw: { semis: [0, 1, 3, 4, 6, 7, 9, 10, 12], nameKey: 'theory.scale.dimhw', subKey: 'theory.scale.sub.halfWhole' },
  phrygdom: { semis: [0, 1, 4, 5, 7, 8, 10, 12], nameKey: 'theory.scale.phrygdom' },
};

// ── 音级 ──────────────────────────────────────────────────────────────────────
// id 与 tonic 之上的半音偏移一一对应；唱名与级数记号本身与语言无关。

export interface DegreeDef {
  readonly semis: number;
  readonly solfege: string;
  readonly number: string;
}

export const DEGREES: Record<string, DegreeDef> = {
  do: { semis: 0, solfege: 'Do', number: '1' },
  ra: { semis: 1, solfege: 'Ra', number: '♭2' },
  re: { semis: 2, solfege: 'Re', number: '2' },
  me: { semis: 3, solfege: 'Me', number: '♭3' },
  mi: { semis: 4, solfege: 'Mi', number: '3' },
  fa: { semis: 5, solfege: 'Fa', number: '4' },
  fi: { semis: 6, solfege: 'Fi', number: '♯4' },
  sol: { semis: 7, solfege: 'Sol', number: '5' },
  le: { semis: 8, solfege: 'Le', number: '♭6' },
  la: { semis: 9, solfege: 'La', number: '6' },
  te: { semis: 10, solfege: 'Te', number: '♭7' },
  ti: { semis: 11, solfege: 'Ti', number: '7' },
};

// ── 级数与终止式 ──────────────────────────────────────────────────────────────
// root = 主音之上的半音数；quality 指向 CHORDS。

export interface NumeralDef {
  readonly root: number;
  readonly quality: string;
  readonly name: string;
}

export const NUMERALS: Record<string, NumeralDef> = {
  I: { root: 0, quality: 'maj', name: 'I' },
  ii: { root: 2, quality: 'min', name: 'ii' },
  iii: { root: 4, quality: 'min', name: 'iii' },
  IV: { root: 5, quality: 'maj', name: 'IV' },
  V: { root: 7, quality: 'maj', name: 'V' },
  vi: { root: 9, quality: 'min', name: 'vi' },
  i: { root: 0, quality: 'min', name: 'i' },
  iv: { root: 5, quality: 'min', name: 'iv' },
  VI: { root: 8, quality: 'maj', name: 'VI' },
  VII: { root: 10, quality: 'maj', name: 'VII' },
};

/** 功能题先给一个终止式把调性立住，再问音级/级数。 */
export const CADENCES: Record<string, readonly string[]> = {
  major: ['I', 'IV', 'V', 'I'],
  minor: ['i', 'iv', 'V', 'i'],
};

// ── 选音工具 ──────────────────────────────────────────────────────────────────

/** 闭区间随机整数。 */
export function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function choice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/** 按权重取一个，weights 与 items 等长。 */
export function weightedChoice<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= weights[i] as number;
    if (r <= 0) {
      return items[i] as T;
    }
  }
  return items[items.length - 1] as T;
}
