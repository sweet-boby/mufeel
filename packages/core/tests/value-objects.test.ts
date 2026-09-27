import { describe, expect, it } from 'vitest';
import {
  clampToRange,
  noteNameToPitch,
  pitchToNoteName,
  positionsOf,
  parseNoteNames,
  rangeToSemitones,
  spanOf,
  intervalBetween,
} from '../src/index';

describe('音高与音名', () => {
  it('C4 是原点，八度边界按 floor 划分', () => {
    expect(noteNameToPitch('C4')).toBe(0);
    expect(noteNameToPitch('A4')).toBe(9);
    expect(noteNameToPitch('C5')).toBe(12);
    expect(noteNameToPitch('C3')).toBe(-12);
    // -1 个半音必须是 B3，而不是 C4
    expect(pitchToNoteName(-1)).toBe('B3');
    expect(pitchToNoteName(-12)).toBe('C3');
    expect(pitchToNoteName(0)).toBe('C4');
    expect(pitchToNoteName(13)).toBe('C#5');
  });

  it('音名与音高能互相还原（覆盖整个打包音域）', () => {
    for (let value = -36; value <= 35; value += 1) {
      expect(noteNameToPitch(pitchToNoteName(value))).toBe(value);
    }
  });

  it('音名拼写非法时抛错，而不是悄悄返回 NaN', () => {
    expect(() => noteNameToPitch('H4')).toThrow();
    expect(() => noteNameToPitch('C')).toThrow();
    expect(parseNoteNames(['C3', 'E3', 'G3'])).toEqual([-12, -8, -5]);
  });

  it('音域工具函数', () => {
    expect(rangeToSemitones({ min: -12, max: 12 })).toHaveLength(25);
    expect(clampToRange(99, { min: -12, max: 12 })).toBe(12);
    expect(clampToRange(-99, { min: -12, max: 12 })).toBe(-12);
  });
});

describe('名次与音程', () => {
  it('名次就是升序排序后的位置', () => {
    // 播放顺序 G4(7) / C4(0) / E4(4) -> 第一声排第 3、第二声排第 1、第三声排第 2
    expect(positionsOf([7, 0, 4])).toEqual([3, 1, 2]);
    expect(positionsOf([0, 1])).toEqual([1, 2]);
    expect(positionsOf([5, -3, 12, 0])).toEqual([3, 1, 4, 2]);
  });

  it('跨度是最高音减最低音', () => {
    expect(spanOf([7, 0, 4])).toBe(7);
    expect(spanOf([-12, 0])).toBe(12);
    expect(spanOf([3])).toBe(0);
  });

  it('音程带方向', () => {
    expect(intervalBetween(0, 7)).toEqual({ semitones: 7, direction: 'ascending' });
    expect(intervalBetween(7, 0)).toEqual({ semitones: 7, direction: 'descending' });
  });
});
