/**
 * 统计页：连续天数、正确率、十二周活动热力图、模块进度与「最容易混淆」。
 */

import type { JSX } from 'react';
import { MODULES, moduleById } from '../../course/curriculum';
import { CHORDS, DEGREES, INTERVALS, SCALES } from '@yuegan/core';
import { scaleNameKey } from '../../i18n/domain-labels';
import { useT } from '../../i18n';
import * as Progress from '../../infrastructure/progress';
import { chordEvents, intervalEvents, scaleEvents } from '../../questions/events';
import { pianoEngine } from '../../infrastructure/audio/piano-engine';
import { TopBar, formatPct, moduleColor } from '../components/Chrome';
import { useProgressVersion } from '../hooks';

const COMPARABLE = ['intervals', 'chords', 'scales', 'degrees'];

export function StatsScreen(): JSX.Element {
  const t = useT();
  useProgressVersion();
  const state = Progress.getState();

  const totalLevels = MODULES.reduce((sum, mod) => sum + mod.levels.length, 0);
  const doneLevels = MODULES.reduce((sum, mod) => sum + Progress.moduleCompletedCount(mod.id), 0);

  const confusionName = (moduleId: string, id: string): string => {
    if (moduleId === 'intervals') return INTERVALS[id]?.short ?? id;
    if (moduleId === 'chords') return CHORDS[id]?.short ?? id;
    if (moduleId === 'scales') return t(scaleNameKey(id));
    if (moduleId === 'degrees') return DEGREES[id]?.solfege ?? id;
    return id;
  };

  const comparePlay = (moduleId: string, id: string): void => {
    pianoEngine.unlock();
    pianoEngine.stopNow();
    const root = 60;
    if (moduleId === 'intervals' && INTERVALS[id] !== undefined) {
      void pianoEngine.playEvents(intervalEvents(root, INTERVALS[id].semitones, 'a'));
    } else if (moduleId === 'chords' && CHORDS[id] !== undefined) {
      void pianoEngine.playEvents(
        chordEvents(root, CHORDS[id].semitones, state.settings.chordStyle),
      );
    } else if (moduleId === 'scales' && SCALES[id] !== undefined) {
      void pianoEngine.playEvents(scaleEvents(root, SCALES[id].semitones));
    } else if (moduleId === 'degrees') {
      const degree = DEGREES[id];
      if (degree !== undefined) {
        void pianoEngine.playEvents([
          { midi: root, at: 0, dur: 0.6 },
          { midi: root + degree.semitones, at: 0.75, dur: 0.9 },
        ]);
      }
    }
  };

  // 活动热力图：最近 12 周，列是周、行是星期
  const cells: JSX.Element[] = [];
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (83 + ((now.getDay() + 6) % 7)));
  for (let week = 0; week < 13; week += 1) {
    const column: JSX.Element[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + day);
      if (date > now) {
        column.push(<span key={day} className="acell empty" />);
        continue;
      }
      const key = date.toISOString().slice(0, 10);
      const answers = state.activity[key]?.a ?? 0;
      const level = answers === 0 ? 0 : answers < 10 ? 1 : answers < 30 ? 2 : 3;
      column.push(
        <span
          key={day}
          className={`acell l${level}`}
          title={t('stats.dayTooltip', { date: key, count: answers })}
        />,
      );
    }
    cells.push(
      <div key={week} className="acol">
        {column}
      </div>,
    );
  }

  const confusions = Progress.topConfusions(8);

  const statCard = (icon: string, big: string, label: string, sub: string): JSX.Element => (
    <div className="card stat-card">
      <div className="sc-icon">{icon}</div>
      <div className="sc-big">{big}</div>
      <div className="sc-label">{label}</div>
      {sub !== '' ? <div className="tiny muted">{sub}</div> : null}
    </div>
  );

  return (
    <div className="page">
      <TopBar active="stats" />
      <h1>{t('stats.title')}</h1>

      <div className="stat-cards">
        {statCard('🔥', String(state.streak.current), t('stats.streak'), t('stats.streakBest', { days: state.streak.best }))}
        {statCard(
          '🎯',
          formatPct(state.totals.c, state.totals.a),
          t('stats.accuracy'),
          t('stats.answers', { count: state.totals.a }),
        )}
        {statCard('⛰', `${doneLevels}/${totalLevels}`, t('stats.levels'), '')}
        {statCard('📅', String(Object.keys(state.activity).length), t('stats.days'), '')}
      </div>

      <h2>{t('stats.weeks')}</h2>
      <div className="agrid">{cells}</div>

      <h2>{t('stats.modules')}</h2>
      <div className="stat-modules">
        {MODULES.map((mod) => {
          const done = Progress.moduleCompletedCount(mod.id);
          let answered = 0;
          let correct = 0;
          for (let i = 0; i < mod.levels.length; i += 1) {
            const levelStats = Progress.levelStats(mod.id, i);
            answered += levelStats.a;
            correct += levelStats.c;
          }
          return (
            <div key={mod.id} className="stat-mod card" style={moduleColor(mod.color)}>
              <span className="mc-icon">{mod.icon}</span>
              <div className="sm-main">
                <div className="sm-title">{t(mod.titleKey)}</div>
                <div className="sm-bar">
                  <div
                    className="sm-fill"
                    style={{ width: `${(done / mod.levels.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="sm-side">
                {done}/{mod.levels.length}
                <div className="tiny muted">
                  {answered > 0 ? `${formatPct(correct, answered)} · ${answered}` : '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {confusions.length > 0 ? <h2>{t('stats.confusions')}</h2> : null}
      {confusions.length > 0 ? (
        <div className="confusions">
          {confusions.map((row) => {
            const modTitle = moduleById(row.moduleId);
            const correctName = confusionName(row.moduleId, row.correctId);
            const answeredName = confusionName(row.moduleId, row.answeredId);
            return (
              <div key={`${row.moduleId}-${row.correctId}-${row.answeredId}`} className="card confusion-row">
                <div className="cf-main">
                  <div>
                    {t('stats.heardAs', { a: correctName, b: answeredName })}
                  </div>
                  <div className="tiny muted">
                    {(modTitle === undefined ? row.moduleId : t(modTitle.titleKey))} · {row.count}×
                  </div>
                </div>
                {COMPARABLE.includes(row.moduleId) ? (
                  <div className="cf-btns">
                    <button type="button" className="btn small" onClick={() => comparePlay(row.moduleId, row.correctId)}>
                      ▶ {correctName}
                    </button>
                    <button type="button" className="btn small" onClick={() => comparePlay(row.moduleId, row.answeredId)}>
                      ▶ {answeredName}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
