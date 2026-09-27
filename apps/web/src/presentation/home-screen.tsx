/**
 * 首页：选练习规格（音数 + 难度）。
 * 这里没有任何业务规则，规则在 core 的 drill-spec / exercise-generator 里。
 */

import {
  MAX_NOTE_COUNT,
  MIN_NOTE_COUNT,
  SPAN_PATTERN_LABELS,
  type PitchSpanPattern,
} from '@yuegan/core';
import type { JSX } from 'react';
import type { DrillSpecChoice } from './use-drill';

const NOTE_COUNT_OPTIONS = Array.from(
  { length: MAX_NOTE_COUNT - MIN_NOTE_COUNT + 1 },
  (_, index) => MIN_NOTE_COUNT + index,
);

const SPAN_OPTIONS: readonly { value: PitchSpanPattern; hint: string }[] = [
  { value: 'unrestricted', hint: '音可以散布在整个音域里，跨度不限' },
  { value: 'within-octave', hint: '所有音挤在同一个八度里，更难分辨' },
];

const SPAN_HINTS: Record<PitchSpanPattern, string> = {
  unrestricted: '音可以散布在整个音域里，跨度不限',
  'within-octave': '所有音挤在同一个八度里，更难分辨',
};

export interface HomeScreenProps {
  choice: DrillSpecChoice;
  onChange: (choice: DrillSpecChoice) => void;
  recentAccuracy: number | null;
  recentCount: number;
  onStart: () => void;
}

export function HomeScreen({
  choice,
  onChange,
  recentAccuracy,
  recentCount,
  onStart,
}: HomeScreenProps): JSX.Element {
  return (
    <div className="screen home">
      <header className="hero">
        <h1>乐感练习</h1>
        <p className="hero-sub">
          系统会依次弹出几个音。拖动滑块，把每个音排到它该在的位置：数字越大表示音越高。
        </p>
      </header>

      <section className="card">
        <div className="field">
          <span className="field-label">每道题弹几个音</span>
          <div className="segmented" role="radiogroup" aria-label="每道题弹几个音">
            {NOTE_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={choice.noteCount === count}
                className={choice.noteCount === count ? 'seg is-active' : 'seg'}
                onClick={() => onChange({ ...choice, noteCount: count })}
              >
                {count} 个音
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">难度</span>
          <div className="segmented" role="radiogroup" aria-label="难度">
            {SPAN_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={choice.spanPattern === option.value}
                className={choice.spanPattern === option.value ? 'seg is-active' : 'seg'}
                onClick={() => onChange({ ...choice, spanPattern: option.value })}
              >
                {SPAN_PATTERN_LABELS[option.value]}
              </button>
            ))}
          </div>
          <p className="field-hint">{SPAN_HINTS[choice.spanPattern]}</p>
        </div>

        <div className="spec-preview">
          本次练习：
          <strong>
            {choice.noteCount} 个音 · {SPAN_PATTERN_LABELS[choice.spanPattern]}
          </strong>
          ，共 10 题
        </div>

        <button type="button" className="primary" onClick={onStart}>
          开始练习
        </button>

        {recentAccuracy !== null && (
          <p className="history">
            最近一局正确率 <strong>{recentAccuracy}%</strong>
            {recentCount > 0 && <span className="muted">（已记录 {recentCount} 局）</span>}
          </p>
        )}
      </section>
    </div>
  );
}
