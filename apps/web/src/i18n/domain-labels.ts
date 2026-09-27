/**
 * 领域 id → 用户可见文字的映射（Web 侧的显示层）。
 *
 * core 只提供音乐事实（有哪些音程/和弦/音阶，各自的半音结构），**不含任何面向用户的名字**；
 * 这里补上「这个名字在中文/英文里叫什么」。所以：
 *   - 加一条内容（比如新音阶）要动两处：core 的内容表 + 这里的名字映射与两份字典；
 *   - core 的内容表里没有的 id，这里查不到就会回落成 id 本身（方便一眼看出漏配）。
 *
 * 另外收在同一个文件里的还有音名与 MIDI 的换算：它们也是「把人看得懂的东西给出去」，
 * 与音乐事实/规则无关。
 */

import type { Semitones } from '@yuegan/core';

// ── 音名与 MIDI ───────────────────────────────────────────────────────────────

/** 界面里的音名用 ♯ / ♭ 拼写；core 内部用 # / b，差别只在展示层。 */
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const midiName = (midi: number): string =>
  `${NOTE_NAMES[((midi % 12) + 12) % 12] ?? 'C'}${Math.floor(midi / 12) - 1}`;

/**
 * core 的音高（C4 = 0）与 MIDI（C4 = 60）之间的换算。
 * 规则跑在 core 的半音坐标里，而播放事件与屏幕键盘用 MIDI 号；
 * 两套坐标只在出题与播放的边界上换算，界面不参与。
 */
export const MIDI_MIDDLE_C = 60;
export const midiFromPitch = (pitch: Semitones): number => pitch + MIDI_MIDDLE_C;
export const pitchFromMidi = (midi: number): number => midi - MIDI_MIDDLE_C;

// ── 音程 ──────────────────────────────────────────────────────────────────────

export const INTERVAL_NAME_KEYS: Record<string, string> = {
  m2: 'theory.interval.m2',
  M2: 'theory.interval.M2',
  m3: 'theory.interval.m3',
  M3: 'theory.interval.M3',
  P4: 'theory.interval.P4',
  TT: 'theory.interval.TT',
  P5: 'theory.interval.P5',
  m6: 'theory.interval.m6',
  M6: 'theory.interval.M6',
  m7: 'theory.interval.m7',
  M7: 'theory.interval.M7',
  P8: 'theory.interval.P8',
  m9: 'theory.interval.m9',
  M9: 'theory.interval.M9',
  P11: 'theory.interval.P11',
  P12: 'theory.interval.P12',
};

/** 参考曲目（提示用）：答错时显示的那句「想想 XXX」。 */
export const INTERVAL_SONG_KEYS: Record<string, { asc?: string; desc?: string }> = {
  m2: { asc: 'song.jaws', desc: 'song.furElise' },
  M2: { asc: 'song.happyBirthday', desc: 'song.maryLamb' },
  m3: { asc: 'song.greensleeves', desc: 'song.heyJude' },
  M3: { asc: 'song.saints', desc: 'song.swingLow' },
  P4: { asc: 'song.bridal', desc: 'song.eineKleine' },
  TT: { asc: 'song.simpsons', desc: 'song.evenFlow' },
  P5: { asc: 'song.starWars', desc: 'song.flintstones' },
  m6: { asc: 'song.entertainer', desc: 'song.loveStory' },
  M6: { asc: 'song.myBonnie', desc: 'song.nobodyKnows' },
  m7: { asc: 'song.somewhere', desc: 'song.watermelonMan' },
  M7: { asc: 'song.takeOnMe', desc: 'song.iLoveYou' },
  P8: { asc: 'song.rainbow', desc: 'song.willowWeep' },
};

export const intervalNameKey = (id: string): string => INTERVAL_NAME_KEYS[id] ?? id;

/** 题目播放方向：earpath 侧问「上行 / 下行 / 同时响」，所以它属于出题层而不是内容层。 */
export const DIRECTIONS: Record<string, { nameKey: string; symbol: string }> = {
  a: { nameKey: 'theory.direction.a', symbol: '↑' },
  d: { nameKey: 'theory.direction.d', symbol: '↓' },
  h: { nameKey: 'theory.direction.h', symbol: '⇈' },
};

// ── 和弦 ──────────────────────────────────────────────────────────────────────

export const CHORD_NAME_KEYS: Record<string, string> = {
  maj: 'theory.chord.maj',
  min: 'theory.chord.min',
  dim: 'theory.chord.dim',
  aug: 'theory.chord.aug',
  sus2: 'theory.chord.sus2',
  sus4: 'theory.chord.sus4',
  dom7: 'theory.chord.dom7',
  maj7: 'theory.chord.maj7',
  min7: 'theory.chord.min7',
  m7b5: 'theory.chord.m7b5',
  dim7: 'theory.chord.dim7',
  mM7: 'theory.chord.mM7',
  maj6: 'theory.chord.maj6',
  min6: 'theory.chord.min6',
  dom9: 'theory.chord.dom9',
  maj9: 'theory.chord.maj9',
  min9: 'theory.chord.min9',
  maj_1: 'theory.chord.majInv1',
  maj_2: 'theory.chord.majInv2',
  min_1: 'theory.chord.minInv1',
  min_2: 'theory.chord.minInv2',
};

export const chordNameKey = (id: string): string => CHORD_NAME_KEYS[id] ?? id;

// ── 音阶 ──────────────────────────────────────────────────────────────────────

export const SCALE_NAME_KEYS: Record<string, string> = {
  major: 'theory.scale.major',
  natmin: 'theory.scale.natmin',
  harmmin: 'theory.scale.harmmin',
  melmin: 'theory.scale.melmin',
  majpent: 'theory.scale.majpent',
  minpent: 'theory.scale.minpent',
  blues: 'theory.scale.blues',
  dorian: 'theory.scale.dorian',
  phrygian: 'theory.scale.phrygian',
  lydian: 'theory.scale.lydian',
  mixolydian: 'theory.scale.mixolydian',
  locrian: 'theory.scale.locrian',
  wholetone: 'theory.scale.wholetone',
  dimhw: 'theory.scale.dimhw',
  phrygdom: 'theory.scale.phrygdom',
};

export const SCALE_SUB_KEYS: Record<string, string> = {
  major: 'theory.scale.sub.ionian',
  natmin: 'theory.scale.sub.aeolian',
  melmin: 'theory.scale.sub.ascending',
  dimhw: 'theory.scale.sub.halfWhole',
};

export const scaleNameKey = (id: string): string => SCALE_NAME_KEYS[id] ?? id;
