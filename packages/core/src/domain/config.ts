/**
 * 领域配置：所有可调参数集中在这里，改难度不需要动规则代码。
 */

import { DEFAULT_RANGE } from './entities/drill-spec';
import { SALAMANDER_SAMPLE_PITCHES, sampleRange } from './value-objects/sample-map';

export interface PlaybackConfig {
  /** 每个音持续多久（毫秒）。 */
  readonly noteDurationMs: number;
  /** 相邻两个音之间留白的时长（毫秒）。 */
  readonly noteGapMs: number;
}

export const DEFAULT_PLAYBACK: PlaybackConfig = {
  noteDurationMs: 1200,
  noteGapMs: 400,
};

export interface AudioConfig {
  /**
   * 采样覆盖的音域。Salamander 采样只提供每 3 个半音一个采样（C、D#、F#、A），
   * 共 27 个文件，覆盖 C1–A7；中间的音靠 ±2 个半音以内的变速变调补齐。
   * 文件全部打包在 apps/web/public/samples/piano 下，不走外网。
   */
  readonly sampleRange: { readonly min: number; readonly max: number };
  readonly playback: PlaybackConfig;
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  sampleRange: sampleRange(SALAMANDER_SAMPLE_PITCHES),
  playback: DEFAULT_PLAYBACK,
};

/** 出题默认音域，与练习规格的默认值保持一致。 */
export const DEFAULT_PITCH_RANGE = DEFAULT_RANGE;

/** 面板等截断用的时间格式。 */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)} 秒`;
}
