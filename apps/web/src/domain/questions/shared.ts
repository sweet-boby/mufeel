/**
 * 生成器共用的小工具：加权抽题、终止式配和声、以及把 core 的播放参数翻成事件。
 */

import { CHORDS, NUMERALS } from '../theory';
import type { PlaybackEvent } from '../playback';
import { cadenceEvents } from '../../infrastructure/audio/events';
import type { GenerateContext } from './types';

/** 刚问过的技能项降权，避免连着出同一题。 */
let lastItemKey: string | null = null;

export function pickWeighted<T extends { itemKey: string }>(
  candidates: readonly T[],
  ctx: GenerateContext,
): T {
  const weights = candidates.map(
    (candidate) =>
      (candidate.itemKey === lastItemKey && candidates.length > 2 ? 0.25 : 1) *
      ctx.weight(candidate.itemKey),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let picked = candidates[candidates.length - 1] as T;
  for (let i = 0; i < candidates.length; i += 1) {
    roll -= weights[i] as number;
    if (roll <= 0) {
      picked = candidates[i] as T;
      break;
    }
  }
  lastItemKey = picked.itemKey;
  return picked;
}

export function resetPickState(): void {
  lastItemKey = null;
}

/** 柱式三和弦，声部安排在 center 附近，另加一个低八度的根音。 */
export function voiceNumeral(keyRoot: number, numeralId: string, center = 64): number[] {
  const numeral = NUMERALS[numeralId];
  if (numeral === undefined) {
    throw new Error(`未知级数：${numeralId}`);
  }
  const chordRoot = keyRoot + numeral.root;
  const base = CHORDS[numeral.quality]?.semis ?? [0, 4, 7];
  const inversions = [
    [base[0], base[1], base[2]],
    [base[1], base[2], (base[0] as number) + 12],
    [base[2], (base[0] as number) + 12, (base[1] as number) + 12],
  ];
  let best: number[] = [];
  let bestDistance = Infinity;
  for (const inversion of inversions) {
    for (const octave of [-12, 0, 12]) {
      const notes = inversion.map((s) => chordRoot + (s as number) + octave);
      const average = notes.reduce((a, b) => a + b, 0) / notes.length;
      const distance = Math.abs(average - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = notes;
      }
    }
  }
  let bass = chordRoot;
  while (bass > 52) bass -= 12;
  while (bass < 41) bass += 12;
  return [bass, ...best];
}

/** 在调性里立一个终止式，功能题（音级、级数）都先放它。 */
export function cadenceFor(keyRoot: number, mode: string, cadences: Record<string, readonly string[]>): PlaybackEvent[] {
  const numerals = cadences[mode] ?? cadences.major ?? [];
  return cadenceEvents(numerals.map((n) => ({ root: 0, semis: voiceNumeral(keyRoot, n) })));
}

export const playFresh = (ctx: GenerateContext, events: readonly PlaybackEvent[]): Promise<void> =>
  ctx.play(events);
