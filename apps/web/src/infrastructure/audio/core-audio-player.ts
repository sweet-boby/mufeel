/**
 * core 的 `AudioPlayer` 端口在采样引擎上的适配器。
 *
 * core 只认「按顺序播放一串音 + 音长/间隔」，所以这里把 core 的半音坐标（C4 = 0）
 * 换算成 MIDI，再交给全站共用的 `PianoEngine`。排序题因此和其他题型共用一套音色，
 * 也共用同一次采样加载。
 */

import { DEFAULT_PLAYBACK, type AudioPlayer, type PlaybackTiming, type Semitones } from '@yuegan/core';
import { midiFromPitch } from '../../i18n/domain-labels';
import type { PlaybackEvent } from '../../questions/playback';
import { pianoEngine, type PianoEngine } from './piano-engine';

export class PianoEngineAudioPlayer implements AudioPlayer {
  constructor(private readonly engine: PianoEngine = pianoEngine) {}

  isReady(): boolean {
    return this.engine.isReady();
  }

  load(onProgress?: (ratio: number) => void): Promise<void> {
    return this.engine.load(onProgress);
  }

  playSequence(pitches: readonly Semitones[], timing?: PlaybackTiming): Promise<void> {
    const { noteDurationMs, noteGapMs } = timing ?? DEFAULT_PLAYBACK;
    const duration = noteDurationMs / 1000;
    const step = duration + noteGapMs / 1000;
    const events: PlaybackEvent[] = pitches.map((pitch, index) => ({
      midi: midiFromPitch(pitch),
      at: index * step,
      dur: duration,
    }));
    return this.engine.playEvents(events);
  }

  async stop(): Promise<void> {
    this.engine.stopNow();
  }
}
