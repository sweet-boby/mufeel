/**
 * 播放事件（领域侧的表示）：一个「什么时候、响哪些音、响多久」的纯数据。
 *
 * 放在 domain 而不是 infrastructure，是为了让题型生成器只依赖这个结构，
 * 不依赖 Web Audio：以后安卓端换播放器时，题型代码一行都不用改。
 */

/** `at` / `dur` 单位是秒；`midis` 用于和弦（同时发声）；`vel` 是 0..1 的力度。 */
export interface PlaybackEvent {
  readonly midi?: number;
  readonly midis?: readonly number[];
  readonly at: number;
  readonly dur: number;
  readonly vel?: number;
}

export function eventsDuration(events: readonly PlaybackEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.at + event.dur), 0);
}

/** 把一串事件整体后移 offset 秒（终止式 + 题目音的拼接）。 */
export function shiftEvents(events: readonly PlaybackEvent[], offset: number): PlaybackEvent[] {
  return events.map((event) => ({ ...event, at: event.at + offset }));
}
