/**
 * 采样播放引擎（基础设施层）：把「一串带时间的音符事件」放出来。
 *
 * 这是全站唯一的发声通道——earpath 侧的题型（音程/和弦/音阶/终止式/旋律）直接给它一串事件，
 * yuegan 侧的排序题经 core 的 `AudioPlayer` 端口（适配器见 `core-audio-player.ts` 的
 * `PianoEngineAudioPlayer`）走到这里。因此全站音色一致，也只有一次采样加载。
 *
 * 音高坐标：本引擎收 MIDI 号（C4 = 60）。core 的半音坐标（C4 = 0）在适配器里换算。
 */

import { eventsDuration, type PlaybackEvent } from '../../domain/playback';
import { loadPianoSamples, type PianoSamples } from './piano-samples';

export class PianoEngine {
  #samples: PianoSamples | null = null;
  #loading: Promise<PianoSamples> | null = null;
  #master: GainNode | null = null;
  #volume = 0.9;
  #active: AudioBufferSourceNode[] = [];
  #timer: ReturnType<typeof setTimeout> | null = null;
  #settle: (() => void) | null = null;

  constructor(private readonly options: { baseUrl?: string } = {}) {}

  isReady(): boolean {
    return this.#samples !== null;
  }

  /** 总音量（设置页的音量滑杆）。 */
  setVolume(value: number): void {
    this.#volume = value;
    if (this.#master !== null) {
      this.#master.gain.value = value;
    }
  }

  get loadedCount(): number {
    return this.#samples?.loadedCount ?? 0;
  }

  get totalCount(): number {
    return this.#samples?.totalCount ?? 0;
  }

  /** 加载采样。必须由用户手势触发（iOS 的 AudioContext 策略）。 */
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
    if (this.#master === null) {
      this.#master = this.#samples.context.createGain();
      this.#master.gain.value = this.#volume;
      this.#master.connect(this.#samples.context.destination);
    }
  }

  /**
   * 播放一串事件，返回的 Promise 在整串播完后 resolve。
   *
   * 兜底定时器：`onended` 在后台标签页、音频上下文被挂起等情况下可能不触发，
   * 一旦不触发界面就会永远卡在「正在播放」（控件全disabled，用户只能刷新）。
   * 所以时长一到就无条件收尾，宁可早一点解锁，也不能锁死界面。
   */
  async playEvents(events: readonly PlaybackEvent[]): Promise<void> {
    const samples = this.#samples;
    if (samples === null) {
      throw new Error('钢琴音色还没加载完');
    }

    this.stopNow();

    const startAt = samples.context.currentTime + 0.05;
    const total = eventsDuration(events);

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

    if (events.length === 0) {
      settle();
      return;
    }

    this.#timer = setTimeout(settle, Math.ceil((total + 0.25) * 1000));

    for (const event of events) {
      const midis = event.midis ?? (event.midi === undefined ? [] : [event.midi]);
      const vel = event.vel ?? 1;
      for (const midi of midis) {
        const { buffer, playbackRate } = samples.pick(midi - 60);
        const source = samples.context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate;

        const gain = samples.context.createGain();
        const noteStart = startAt + event.at;
        const noteEnd = noteStart + event.dur;
        const peak = Math.max(0.001, vel);
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(peak, noteStart + 0.01);
        // 结尾做一个短淡出，避免采样被硬切造成咔哒声。
        gain.gain.setValueAtTime(peak, Math.max(noteStart, noteEnd - 0.08));
        gain.gain.linearRampToValueAtTime(0, noteEnd);

        source.connect(gain).connect(this.#master ?? samples.context.destination);
        source.start(noteStart);
        source.stop(noteEnd);
        source.onended = () => {
          this.#active = this.#active.filter((item) => item !== source);
          if (this.#active.length === 0) {
            settle();
          }
        };
        this.#active.push(source);
      }
    }

    await finished;
  }

  /** 同步停掉所有正在发声的采样（换题、离开页面时用）。 */
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

  /** 用户手势里调用一次，解锁浏览器的音频策略。 */
  unlock(): void {
    const ctx = this.#samples?.context;
    if (ctx !== undefined && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }
}

/** 全站共享一个引擎：一次加载，一套音色。 */
export const pianoEngine = new PianoEngine();
