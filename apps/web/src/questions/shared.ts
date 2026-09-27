/**
 * 生成器共用的小工具：加权抽题、终止式配和声、以及播放事件的转发。
 *
 * 音乐事实全部来自 `@yuegan/core` 的内容表；`voiceNumeral` 也在 core——
 * 「级数怎么摆成听得出性质的柱式和弦」是一条纯算法，不是平台的播放细节。
 * 这里只留出题策略（刚问过的降权）与「把和弦变成播放事件」这个翻译。
 */

import { cadenceNumerals, voiceNumeral } from '@yuegan/core';
import { cadenceEvents } from './events';
import type { PlaybackEvent } from './playback';
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

/** 在调性里立一个终止式，功能题（音级、级数、旋律）都先放它。 */
export function cadenceFor(keyRoot: number, mode: string): PlaybackEvent[] {
  return cadenceEvents(
    cadenceNumerals(mode).map((numeral) => ({ root: 0, semis: voiceNumeral(keyRoot, numeral) })),
  );
}

export const playFresh = (ctx: GenerateContext, events: readonly PlaybackEvent[]): Promise<void> =>
  ctx.play(events);
