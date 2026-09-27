/**
 * AudioPlayer 端口的 Web 实现（基础设施层）。
 *
 * 用原生 Web Audio 而不是 Tone.js：这个练习的所有要求（逐音时序可配、稀疏采样变速、
 * 立刻停止）都直接对应 Web Audio 的三个原语，自己写反而更短、更可控，也少一个依赖。
 * 以后安卓端只需要再写一个实现同一个端口的适配器。
 */

import type { AudioPlayer, PlaybackTiming, Semitones } from '@yuegan/core';
import { DEFAULT_PLAYBACK } from '@yuegan/core';
import { loadPianoSamples, type PianoSamples } from './piano-samples';

export class WebAudioPianoPlayer implements AudioPlayer {
  #samples: PianoSamples | null = null;
  #loading: Promise<PianoSamples> | null = null;
  #active: AudioBufferSourceNode[] = [];
  #timer: ReturnType<typeof setTimeout> | null = null;
  #settle: (() => void) | null = null;

  constructor(private readonly options: { baseUrl?: string } = {}) {}

  isReady(): boolean {
    return this.#samples !== null;
  }

  async load(onProgress?: (ratio: number) => void): Promise<void> {
    if (this.#samples !== null) {
      onProgress?.(1);
      return;
    }
    this.#loading ??= loadPianoSamples({
      ...(this.options.baseUrl === undefined ? {} : { baseUrl: this.options.baseUrl }),
      ...(onProgress === undefined ? {} : { onProgress }),
    });
    this.#samples = await this.#loading;
  }

  async playSequence(pitches: readonly Semitones[], timing?: PlaybackTiming): Promise<void> {
    const samples = this.#samples;
    if (samples === null) {
      throw new Error('钢琴音色还没加载完');
    }

    this.stopNow();

    const { noteDurationMs, noteGapMs } = timing ?? DEFAULT_PLAYBACK;
    const durationSeconds = noteDurationMs / 1000;
    const gapSeconds = noteGapMs / 1000;
    const stepSeconds = durationSeconds + gapSeconds;

    const startAt = samples.context.currentTime + 0.05;
    const totalSeconds = pitches.length === 0 ? 0 : stepSeconds * (pitches.length - 1) + durationSeconds;

    let finish: (() => void) | null = null;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    this.#settle = () => {
      if (finish !== null) {
        const done = finish;
        finish = null;
        this.#timer = null;
        this.#settle = null;
        done();
      }
    };
    const settle = this.#settle;

    // 兜底定时器：onended 在后台标签页、音频上下文被挂起等情况下可能不触发，
    // 一旦不触发，界面就会永远卡在「正在播放」——滑块全禁用，用户只能刷新页面。
    // 所以播放时长一到就无条件收尾（略加余量），宁可早一点解锁，也不能锁死界面。
    this.#timer = setTimeout(settle, Math.ceil((totalSeconds + 0.25) * 1000));

    pitches.forEach((pitch, index) => {
      const { buffer, playbackRate } = samples.pick(pitch);
      const source = samples.context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      const gain = samples.context.createGain();
      // 结尾做一个短淡出，避免采样被硬切造成咔哒声。
      const noteStart = startAt + index * stepSeconds;
      const noteEnd = noteStart + durationSeconds;
      gain.gain.setValueAtTime(1, noteStart);
      gain.gain.setValueAtTime(1, Math.max(noteStart, noteEnd - 0.08));
      gain.gain.linearRampToValueAtTime(0, noteEnd);
      source.connect(gain).connect(samples.context.destination);
      source.start(noteStart);
      source.stop(noteEnd);
      source.onended = () => {
        this.#active = this.#active.filter((item) => item !== source);
        if (this.#active.length === 0) {
          settle();
        }
      };
      this.#active.push(source);
    });

    if (pitches.length === 0) {
      settle();
      return;
    }

    await finished;
  }

  async stop(): Promise<void> {
    this.stopNow();
  }

  /** 同步停掉所有正在发声的采样（换题、提交重播、离开页面时用）。 */
  stopNow(): void {
    for (const source of this.#active) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // 已经停了就忽略
      }
    }
    this.#active = [];
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#settle?.();
    this.#settle = null;
  }
}
