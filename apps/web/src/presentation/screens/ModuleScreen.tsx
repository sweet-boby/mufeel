/**
 * 模块页：一关一关的阶梯，带进度圆环、筹码与解锁状态。
 */

import type { JSX } from 'react';
import { moduleById, type LevelDef } from '../../domain/curriculum';
import { CHORDS, DEGREES, INTERVALS, SCALES } from '../../domain/theory';
import { useT } from '../../i18n';
import * as Progress from '../../infrastructure/progress';
import { Ring, TopBar, formatPct, moduleColor } from '../components/Chrome';
import { go, useProgressVersion } from '../hooks';

export function ModuleScreen({ moduleId }: { moduleId: string }): JSX.Element {
  const t = useT();
  useProgressVersion();
  const mod = moduleById(moduleId);

  if (mod === undefined) {
    return (
      <div className="page">
        <TopBar />
        <p className="muted">{t('module.notFound')}</p>
        <button type="button" className="btn" onClick={() => go('#/')}>
          {t('common.home')}
        </button>
      </div>
    );
  }

  const itemLabel = (id: string): string => {
    switch (moduleId) {
      case 'intervals':
        return INTERVALS[id]?.short ?? id;
      case 'chords':
        return CHORDS[id]?.short ?? id;
      case 'scales':
        return t(SCALES[id]?.nameKey ?? id);
      case 'degrees':
        return Progress.getState().settings.degreeLabels === 'number'
          ? (DEGREES[id]?.number ?? id)
          : (DEGREES[id]?.solfege ?? id);
      default:
        return id;
    }
  };

  const chipsFor = (level: LevelDef): string[] => {
    // 排序关卡的筹码是「几个音 · 哪一档」，这正是它练的东西。
    if (level.kind === 'rank') {
      return [t('module.pitch.rank.chip', { n: level.noteCount }), t(`tier.${level.tier}`)];
    }
    if ('items' in level) return level.items.map(itemLabel);
    if ('pool' in level) return level.pool.map(itemLabel);
    return [];
  };

  return (
    <div className="page" style={moduleColor(mod.color)}>
      <TopBar />
      <div className="mod-head">
        <button type="button" className="iconbtn" aria-label={t('common.back')} onClick={() => go('#/')}>
          ←
        </button>
        <span className="mod-icon">{mod.icon}</span>
        <div>
          <h1>{t(mod.titleKey)}</h1>
          <p className="muted">{t(mod.blurbKey)}</p>
        </div>
      </div>

      <div className="tipbox">
        <strong>{t('module.howToList')} · </strong>
        {t(mod.tipKey)}
      </div>

      <div className="level-list">
        {mod.levels.map((level, index) => {
          const unlocked = Progress.isLevelUnlocked(moduleId, index);
          const complete = Progress.isLevelComplete(moduleId, index);
          const stats = Progress.levelStats(moduleId, index);
          const chips = chipsFor(level);

          const status = complete ? (
            <span className="lv-status done">✓</span>
          ) : unlocked ? (
            <Ring pct={Progress.levelProgress(moduleId, index)} size={34} stroke={4} />
          ) : (
            <span className="lv-status locked">🔒</span>
          );

          const className = `card level-row${unlocked ? '' : ' locked'}${complete ? ' complete' : ''}`;
          const body = (
            <>
              <div className="lv-num">{index + 1}</div>
              <div className="lv-main">
                <div className="lv-name">{t(level.nameKey)}</div>
                <div className="lv-hint">{unlocked ? t(level.hintKey) : t('module.lockedHint')}</div>
                {chips.length > 0 ? (
                  <div className="lv-chips">
                    {chips.map((chip, chipIndex) => (
                      <span key={`${chip}-${chipIndex}`} className="chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="lv-side">
                {stats.a > 0 ? <span className="lv-acc">{formatPct(stats.c, stats.a)}</span> : null}
                {status}
              </div>
            </>
          );

          return unlocked ? (
            <button
              key={level.id}
              type="button"
              className={className}
              onClick={() => go(`#/practice/${moduleId}/${index}`)}
            >
              {body}
            </button>
          ) : (
            <div key={level.id} className={className}>
              {body}
            </div>
          );
        })}
      </div>

      {Progress.getState().settings.freeRoam ? null : (
        <p className="tiny muted" style={{ textAlign: 'center', marginTop: '0.9rem' }}>
          {t('module.freeRoamHint')}{' '}
          <a href="#/settings">{t('nav.settings')}</a>。
        </p>
      )}
    </div>
  );
}
