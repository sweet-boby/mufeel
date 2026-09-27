/**
 * 结果页：正确率 + 逐题明细 + 再来一局。
 */

import { formatRank, type SummaryItemView, type SummaryView } from '@yuegan/core';
import type { CSSProperties, JSX } from 'react';

export interface ResultScreenProps {
  summary: SummaryView;
  specLabel: string;
  onRestartSameSpec: () => void;
  onChangeSpec: () => void;
  onClearHistory: () => void;
}

function ItemRow({ item }: { item: SummaryItemView }): JSX.Element {
  return (
    <li className={item.isCorrect ? 'result-row is-right' : 'result-row is-wrong'}>
      <div className="result-head">
        <span className="result-index">第 {item.exerciseNumber} 题</span>
        <span className={item.isCorrect ? 'tag tag-right' : 'tag tag-wrong'}>
          {item.isCorrect ? '对' : `错 ${item.matchedCount}/${item.noteNames.length}`}
        </span>
      </div>
      <div className="result-body">
        <div className="result-line">
          <span className="muted">真实音高</span>
          <span className="mono">{item.noteNames.join(' → ')}</span>
        </div>
        <div className="result-line">
          <span className="muted">正确位置</span>
          <span className="mono">{item.correctRanks.map((rank) => formatRank(rank)).join(' · ')}</span>
        </div>
        <div className="result-line">
          <span className="muted">你的答案</span>
          <span className="mono">{item.answeredRanks.map((rank) => formatRank(rank)).join(' · ')}</span>
        </div>
      </div>
    </li>
  );
}

export function ResultScreen({
  summary,
  specLabel,
  onRestartSameSpec,
  onChangeSpec,
  onClearHistory,
}: ResultScreenProps): JSX.Element {
  const verdict =
    summary.accuracyPercent >= 80
      ? '听得很稳'
      : summary.accuracyPercent >= 50
        ? '有感觉了，再练一局'
        : '这个难度还比较吃力，可以换简单一点';

  return (
    <div className="screen result">
      <section className="card summary-card">
        <div className="score-ring" style={{ '--percent': `${summary.accuracyPercent}%` } as CSSProperties}>
          <span className="score-value">{summary.accuracyPercent}%</span>
        </div>
        <div className="summary-text">
          <h2>
            {summary.correct} / {summary.total} 题正确
          </h2>
          <p className="muted">
            {specLabel} · {verdict}
          </p>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">逐题明细</h3>
        <ul className="result-list">
          {summary.items.map((item) => (
            <ItemRow key={item.exerciseNumber} item={item} />
          ))}
        </ul>
      </section>

      <div className="actions">
        <button type="button" className="primary" onClick={onRestartSameSpec}>
          再练一局（同规格）
        </button>
        <button type="button" className="ghost" onClick={onChangeSpec}>
          换规格
        </button>
        <button type="button" className="ghost subtle" onClick={onClearHistory}>
          清空历史记录
        </button>
      </div>
    </div>
  );
}
