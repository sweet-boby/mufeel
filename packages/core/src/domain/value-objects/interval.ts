/**
 * 音程值对象。
 *
 * 一个音程记录「两个音之间差多少个半音、谁在上面」，因此在 v1「只判排序」的模式下
 * 它不参与判分——它存在是为了反馈（「C3 → G5，差 19 个半音」）
 * 以及 v2 的音程判断练习。
 */

import type { Semitones } from './pitch';

export interface Interval {
  /** 两个音之间相差的半音数（非负）。 */
  readonly semitones: number;
  /** 高的那个音在低音之上多少个半音（等于 semitones，正数即「向上」）。 */
  readonly direction: 'ascending' | 'descending';
}

export function intervalBetween(from: Semitones, to: Semitones): Interval {
  const diff = to - from;
  return {
    semitones: Math.abs(diff),
    direction: diff >= 0 ? 'ascending' : 'descending',
  };
}

/** 一组音高的总跨度（最高音 − 最低音）。0 表示所有音同高。 */
export function spanOf(values: readonly Semitones[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.max(...values) - Math.min(...values);
}

export function formatInterval(interval: Interval): string {
  const arrow = interval.direction === 'ascending' ? '↑' : '↓';
  return `${arrow} ${interval.semitones} 个半音`;
}
