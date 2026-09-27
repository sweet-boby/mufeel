/**
 * 出题器（ExerciseGenerator）：领域服务。
 *
 * 规则（全部来自已确认的产品决定）：
 * 1. 一道题有 n 个音，n 由练习规格给定，2 ≤ n ≤ 5。
 * 2. 所有音互不相同，取值落在规格的音域内。
 * 3. 「八度内」= 整题跨度（最高音 − 最低音）≤ 12 个半音；「全音域」= 不限制跨度。
 * 4. 每道题先随机挑一个「窗口」再在窗口里取音，保证音高不会总是贴着音域两端。
 * 5. 播放顺序随机打乱——否则答案永远是 1…n，一眼可解。
 * 6. 正确答案由音高唯一确定：升序名次。
 */

import type { DrillSpec } from '../entities/drill-spec';
import { maxSpanOf } from '../entities/drill-spec';
import type { Exercise } from '../entities/exercise';
import type { RandomSource } from '../ports/random-source';
import { shuffle } from '../ports/random-source';
import type { Semitones } from '../value-objects/pitch';

export interface ExerciseGenerator {
  generate(spec: DrillSpec, id: string): Exercise;
}

/** 枚举所有合法窗口：窗口起点 + (n-1) 个音必须在音域内，且不超过跨度上限。 */
function enumerateWindows(spec: DrillSpec): number[] {
  const span = maxSpanOf(spec);
  const low = spec.range.min;
  const high = spec.range.max;
  const windows: number[] = [];
  // 窗口最远只需要覆盖 span（「全音域」时 span 就是整个音域宽度）。
  for (let start = low; start + span <= high; start += 1) {
    windows.push(start);
  }
  // 音域比 span 还窄的极端配置：退化成只有一个窗口。
  return windows.length > 0 ? windows : [low];
}

/** 从 [0, slotCount) 里等概率取 count 个互不相同的下标，返回升序。 */
function sampleIndices(slotCount: number, count: number, random: RandomSource): number[] {
  const pool = Array.from({ length: slotCount }, (_, index) => index);
  const chosen: number[] = [];
  for (let picked = 0; picked < count; picked += 1) {
    const index = Math.floor(random.next() * pool.length);
    const [value] = pool.splice(Math.min(index, pool.length - 1), 1);
    chosen.push(value as number);
  }
  return chosen.sort((a, b) => a - b);
}

export function createExerciseGenerator(random: RandomSource): ExerciseGenerator {
  return {
    generate(spec: DrillSpec, id: string): Exercise {
      const noteCount = spec.noteCount;
      if (noteCount < 2) {
        throw new Error(`每道题至少要有 2 个音，收到 ${noteCount}`);
      }

      const windows = enumerateWindows(spec);
      const windowStart = windows[Math.min(Math.floor(random.next() * windows.length), windows.length - 1)] as number;
      const slotCount = Math.min(maxSpanOf(spec), spec.range.max - windowStart) + 1;
      if (slotCount < noteCount) {
        throw new Error(
          `音域内放不下 ${noteCount} 个互不相同的音（可用半音数 ${slotCount}）`,
        );
      }

      const offsets = sampleIndices(slotCount, noteCount, random);
      const pitches: Semitones[] = offsets.map((offset) => windowStart + offset);

      return { id, pitches: shuffle(pitches, random) };
    },
  };
}
