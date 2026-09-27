import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assignSample,
  clampToSampleRange,
  maxDetuneSemitones,
  maxSampleGap,
  noteNameToPitch,
  pitchToNoteName,
  SALAMANDER_SAMPLE_NOTE_NAMES,
  SALAMANDER_SAMPLE_PITCHES,
  sampleRange,
} from '../src/index';

/** 采样文件在 web 应用里，测试直接读目录，保证映射表和磁盘内容不会漂移。 */
const SAMPLES_DIR = fileURLToPath(
  new URL('../../../apps/web/public/samples/piano', import.meta.url),
);

describe('稀疏采样映射', () => {
  it('映射表与磁盘上的采样文件一一对应', () => {
    // 文件名用「s 代替 #」的拼写：Ds3.mp3 / Fs7.mp3；先解析成音高再规范回音名。
    const onDisk = readdirSync(SAMPLES_DIR)
      .filter((name) => name.endsWith('.mp3'))
      .map((name) => pitchToNoteName(noteNameToPitch(name.replace(/\.mp3$/, ''))))
      .sort();

    expect(onDisk).toHaveLength(SALAMANDER_SAMPLE_NOTE_NAMES.length);
    expect([...SALAMANDER_SAMPLE_NOTE_NAMES].sort()).toEqual(onDisk);
  });

  it('采样集覆盖 C1–A7，每 3 个半音一个', () => {
    expect(SALAMANDER_SAMPLE_PITCHES).toHaveLength(28);
    expect(sampleRange()).toEqual({ min: -36, max: 45 }); // C1 = -36, A7 = 45
    expect(maxSampleGap()).toBe(3);
    expect(maxDetuneSemitones()).toBe(2);
  });

  it('采样点上的音零变调', () => {
    expect(assignSample(0)).toMatchObject({
      sampleNoteName: 'C4',
      detuneSemitones: 0,
      playbackRate: 1,
    });
    expect(assignSample(-15)).toMatchObject({ sampleNoteName: 'A2', detuneSemitones: 0 });
    expect(assignSample(-3)).toMatchObject({ sampleNoteName: 'A3', detuneSemitones: 0 });
  });

  it('两个采样之间的音取最近的那个', () => {
    // C4(0) 与 D#4(3) 之间：C#4(1) 更靠近 C4，D4(2) 更靠近 D#4
    expect(assignSample(1)).toMatchObject({ sampleNoteName: 'C4', detuneSemitones: 1 });
    expect(assignSample(2)).toMatchObject({ sampleNoteName: 'D#4', detuneSemitones: -1 });
  });

  it('练习音域 C3–C5 内变调不超过 1 个半音，音高准确度有保障', () => {
    for (let pitch = -12; pitch <= 12; pitch += 1) {
      const assignment = assignSample(pitch);
      expect(Math.abs(assignment.detuneSemitones)).toBeLessThanOrEqual(1);
      expect(assignment.playbackRate).toBeGreaterThan(0.94);
      expect(assignment.playbackRate).toBeLessThan(1.06);
    }
  });

  it('整个采样范围内变调不超过 2 个半音，不会出现听不出音高的情况', () => {
    for (let pitch = -36; pitch <= 45; pitch += 1) {
      expect(Math.abs(assignSample(pitch).detuneSemitones)).toBeLessThanOrEqual(2);
    }
  });

  it('超出采样范围的音高被夹到两端，不会没声音', () => {
    expect(clampToSampleRange(99, SALAMANDER_SAMPLE_PITCHES)).toBe(45); // A7
    expect(clampToSampleRange(-99, SALAMANDER_SAMPLE_PITCHES)).toBe(-36); // C1
    expect(clampToSampleRange(99, [-12, 0, 12])).toBe(12);
    // 超出采样范围的音先被夹回范围，所以变调量是 0（v1 的出题音域也用不到那么高）
    expect(assignSample(60)).toMatchObject({ sampleNoteName: 'A7', detuneSemitones: 0 });
    expect(assignSample(-60)).toMatchObject({ sampleNoteName: 'C1', detuneSemitones: 0 });
  });
});
