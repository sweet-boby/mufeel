/**
 * 音频播放端口：领域与应用层只认这三个方法，不知道背后是 Tone.js、Web Audio，
 * 还是以后安卓端的原生采样播放器。
 */

import type { Semitones } from '../value-objects/pitch';

export interface AudioPlayer {
  /** 采样是否已经就绪；未就绪时不允许出题，避免用户点了播放却没声音。 */
  isReady(): boolean;
  /** 加载采样。onProgress 收到 [0,1] 的进度，用于「正在准备钢琴音色」。 */
  load(onProgress?: (ratio: number) => void): Promise<void>;
  /**
   * 按顺序播放一串音。返回的 Promise 在整串播完后 resolve。
   * timing 由领域配置提供（音长、音间留白），播放器不该自己写死节奏。
   */
  playSequence(pitches: readonly Semitones[], timing?: PlaybackTiming): Promise<void>;
  /** 立刻停止当前播放（离开页面、换题时调用）。 */
  stop(): Promise<void>;
}

/** 演奏参数（音长、间隔）由领域配置提供，经应用层传给播放器。 */
export interface PlaybackTiming {
  readonly noteDurationMs: number;
  readonly noteGapMs: number;
}
