/**
 * 采样映射（纯逻辑，所以放在 core 里测，播放器只负责执行）。
 *
 * 真实世界的音乐采样是稀疏的：Salamander 钢琴只提供每 3 个半音一个采样
 * （C、D#、F#、A），共 28 个，覆盖 C1–A7。中间的音靠「取最近的采样 + 变速变调」得到。
 * 这个文件回答两个问题：
 *   1. 任意音高应该用哪个采样文件？
 *   2. 相对采样原速要偏移多少个半音（playbackRate = 2^(n/12)）？
 */

import { noteNameToPitch, pitchToNoteName } from './note-name';
import type { Semitones } from './pitch';

/** 稀疏采样的原始音高，升序。 */
export type SamplePitches = readonly Semitones[];

/**
 * Salamander 采样集的真实音高（28 个），从 C1 到 A7。
 *
 * 规律是每 3 个半音一个：C / D# / F# / A，横跨 7 个八度，从 C1 到 A7。
 * 文件名用的是「s 代替 #」的拼写（Ds3.mp3、Fs7.mp3），这里用标准升号拼写，
 * 播放器负责把音名转成文件名。
 * 这份表必须和 apps/web/public/samples/piano/ 里的文件一一对应——
 * sample-map 的测试会直接读那个目录做校验，谁都别想偷偷漂移。
 */
const SAMPLE_NOTE_NAMES: readonly string[] = [
  'C1', 'D#1', 'F#1', 'A1',
  'C2', 'D#2', 'F#2', 'A2',
  'C3', 'D#3', 'F#3', 'A3',
  'C4', 'D#4', 'F#4', 'A4',
  'C5', 'D#5', 'F#5', 'A5',
  'C6', 'D#6', 'F#6', 'A6',
  'C7', 'D#7', 'F#7', 'A7',
];

export const SALAMANDER_SAMPLE_NOTE_NAMES: readonly string[] = SAMPLE_NOTE_NAMES;

export const SALAMANDER_SAMPLE_PITCHES: SamplePitches = SAMPLE_NOTE_NAMES.map(noteNameToPitch);

export interface SampleAssignment {
  /** 采样文件的音名，例如 "D#3"。 */
  readonly sampleNoteName: string;
  /** 采样本身的音高。 */
  readonly samplePitch: Semitones;
  /** 需要的变调量（半音）：正数表示把采样升高。 */
  readonly detuneSemitones: number;
  /** Web Audio / Tone.js 的 playbackRate = 2^(detuneSemitones/12)。 */
  readonly playbackRate: number;
}

function closestIndex(pitches: SamplePitches, target: Semitones): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  pitches.forEach((pitch, index) => {
    const distance = Math.abs(pitch - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/** 目标音高超出采样范围时，夹到采样范围内最接近的音（保证永远有声音）。 */
export function clampToSampleRange(target: Semitones, samples: SamplePitches): Semitones {
  const lowest = samples[0] as Semitones;
  const highest = samples[samples.length - 1] as Semitones;
  return Math.min(highest, Math.max(lowest, target));
}

/** 为任意音高挑采样并算出变调量。 */
export function assignSample(
  target: Semitones,
  samples: SamplePitches = SALAMANDER_SAMPLE_PITCHES,
): SampleAssignment {
  if (samples.length === 0) {
    throw new Error('没有可用采样');
  }
  const clamped = clampToSampleRange(target, samples);
  const samplePitch = samples[closestIndex(samples, clamped)] as Semitones;
  const detuneSemitones = clamped - samplePitch;
  return {
    sampleNoteName: pitchToNoteName(samplePitch),
    samplePitch,
    detuneSemitones,
    playbackRate: 2 ** (detuneSemitones / 12),
  };
}

/** 一次变调的最大幅度——稀疏采样的代价就体现为这个数。 */
export function maxDetuneSemitones(samples: SamplePitches = SALAMANDER_SAMPLE_PITCHES): number {
  return Math.ceil(maxSampleGap(samples) / 2);
}

/** 采样之间的最大间隔（半音）。 */
export function maxSampleGap(samples: SamplePitches = SALAMANDER_SAMPLE_PITCHES): number {
  let maxGap = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const gap = (samples[index] as number) - (samples[index - 1] as number);
    if (gap > maxGap) {
      maxGap = gap;
    }
  }
  return maxGap;
}

/** 覆盖的音域（用于配置与文档）。 */
export function sampleRange(samples: SamplePitches = SALAMANDER_SAMPLE_PITCHES): {
  readonly min: Semitones;
  readonly max: Semitones;
} {
  return { min: samples[0] as Semitones, max: samples[samples.length - 1] as Semitones };
}
