/**
 * 首页：选练习规格（音数 + 难度）。
 * 这里没有任何业务规则，规则在 core 的 drill-spec / exercise-generator 里。
 */

import {
  DEFAULT_EXERCISE_COUNT,
  DIFFICULTY_TIERS,
  DIFFICULTY_TIER_ORDER,
  MAX_NOTE_COUNT,
  MIN_NOTE_COUNT,
} from '@yuegan/core';
import type { JSX } from 'react';
import type { DrillSpecChoice } from './use-drill';

const NOTE_COUNT_OPTIONS = Array.from(
  { length: MAX_NOTE_COUNT - MIN_NOTE_COUNT + 1 },
  (_, index) => MIN_NOTE_COUNT + index,
);

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
  const tier = DIFFICULTY_TIERS[choice.tier];

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
            {DIFFICULTY_TIER_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={choice.tier === value}
                className={choice.tier === value ? 'seg is-active' : 'seg'}
                onClick={() => onChange({ ...choice, tier: value })}
              >
                {DIFFICULTY_TIERS[value].label}
              </button>
            ))}
          </div>
          <p className="field-hint">{tier.hint}</p>
        </div>

        <div className="spec-preview">
          本次练习：
          <strong>
            {choice.noteCount} 个音 · {tier.label}
          </strong>
          ，共 {DEFAULT_EXERCISE_COUNT} 题
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
