/**
 * 事件构造器（基础设施层）：把「音程 / 和弦 / 音阶 / 终止式 / 旋律」翻译成时间轴上的音符。
 *
 * 与 earpath-app 的 js/audio.js 同名同义，区别只是输出成 `NoteEvent[]` 再交给采样引擎，
 * 而不是自己调度振荡器。节奏写在这里，题型只管调用。
 */

import type { PlaybackEvent } from './playback';

/** dir: 'a' 上行 / 'd' 下行 / 'h' 同时发声。rootMidi 是第一个音。 */
export function intervalEvents(
  rootMidi: number,
  semis: number,
  dir: string,
  opts: { noteDur?: number } = {},
): PlaybackEvent[] {
  const dur = opts.noteDur ?? 0.7;
  const gap = 0.18;
  const other = dir === 'd' ? rootMidi - semis : rootMidi + semis;
  if (dir === 'h') {
    return [{ midis: [rootMidi, other], at: 0, dur: dur + 0.35 }];
  }
  return [
    { midi: rootMidi, at: 0, dur },
    { midi: other, at: dur + gap, dur },
  ];
}

/** style: 'block' 柱式 / 'block+arp' 柱式后加琶音 / 'arp' 只琶音。 */
export function chordEvents(
  rootMidi: number,
  semis: readonly number[],
  style: 'block' | 'block+arp' | 'arp' = 'block+arp',
): PlaybackEvent[] {
  const midis = semis.map((s) => rootMidi + s);
  const vel = Math.min(1, 2.6 / midis.length);
  const events: PlaybackEvent[] = [];
  let at = 0;
  if (style !== 'arp') {
    events.push({ midis, at: 0, dur: 1.1, vel });
    at = 1.35;
  }
  if (style !== 'block') {
    midis.forEach((m, i) => events.push({ midi: m, at: at + i * 0.22, dur: 0.6, vel: 0.85 }));
  }
  return events;
}

export function scaleEvents(rootMidi: number, semis: readonly number[]): PlaybackEvent[] {
  return semis.map((s, i) => ({ midi: rootMidi + s, at: i * 0.34, dur: 0.32 }));
}

export function melodyEvents(midis: readonly number[], tempo = 0.5): PlaybackEvent[] {
  return midis.map((m, i) => ({ midi: m, at: i * tempo, dur: tempo * 0.92 }));
}

/** 柱式和弦终止式，用来立住调性。 */
export function cadenceEvents(
  chords: readonly { readonly root: number; readonly semis: readonly number[] }[],
): PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  chords.forEach((chord, i) => {
    const last = i === chords.length - 1;
    events.push({
      midis: chord.semis.map((s) => chord.root + s),
      at: i * 0.62,
      dur: last ? 0.95 : 0.58,
      vel: 0.55,
    });
  });
  return events;
}
