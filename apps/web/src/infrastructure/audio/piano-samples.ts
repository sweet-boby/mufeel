/**
 * 钢琴音色加载器（基础设施层）。
 *
 * 采样资源打包在 public/samples/piano/ 下，不走外网。
 * 每个音高该用哪个采样、要变调多少，由 core 的 assignSample 决定；
 * 这里只负责 fetch、decode 和把 AudioBuffer 存起来。
 */

import { assignSample, SALAMANDER_SAMPLE_NOTE_NAMES, type Semitones } from '@yuegan/core';

/** 采样文件名用的拼写是 Ds3 / Fs3，音名里写成 D#3。 */
function fileBaseName(noteName: string): string {
  return noteName.replace('#', 's');
}

export function sampleUrl(noteName: string, baseUrl: string): string {
  return `${baseUrl}samples/piano/${fileBaseName(noteName)}.mp3`;
}

export interface PianoSamples {
  readonly context: AudioContext;
  /** 为某个音高挑出采样与变速比例。 */
  pick(pitch: Semitones): { buffer: AudioBuffer; playbackRate: number };
  readonly loadedCount: number;
  readonly totalCount: number;
}

async function decode(context: AudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`采样加载失败（HTTP ${response.status}）：${url}`);
  }
  const bytes = await response.arrayBuffer();
  return context.decodeAudioData(bytes);
}

export async function loadPianoSamples(
  options: { baseUrl?: string; onProgress?: (ratio: number) => void } = {},
): Promise<PianoSamples> {
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  const context = new AudioContext();
  // 首次进入页面时 AudioContext 可能是 suspended，必须由用户手势触发才能 resume。
  if (context.state === 'suspended') {
    await context.resume();
  }

  const total = SALAMANDER_SAMPLE_NOTE_NAMES.length;
  const buffers = new Map<string, AudioBuffer>();
  let done = 0;

  await Promise.all(
    SALAMANDER_SAMPLE_NOTE_NAMES.map(async (noteName) => {
      const buffer = await decode(context, sampleUrl(noteName, baseUrl));
      buffers.set(noteName, buffer);
      done += 1;
      options.onProgress?.(done / total);
    }),
  );

  return {
    context,
    loadedCount: done,
    totalCount: total,
    pick(pitch: Semitones) {
      const assignment = assignSample(pitch);
      const buffer = buffers.get(assignment.sampleNoteName);
      if (buffer === undefined) {
        throw new Error(`缺少采样：${assignment.sampleNoteName}`);
      }
      return { buffer, playbackRate: assignment.playbackRate };
    },
  };
}
