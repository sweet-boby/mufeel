/**
 * 首页：继续练习、每日混合、七个模块的进度总览。
 */

import type { JSX } from 'react';
import { MODULES, moduleById } from '../../domain/curriculum';
import { useT } from '../../i18n';
import * as Progress from '../../infrastructure/progress';
import { Ring, TopBar, moduleColor } from '../components/Chrome';
import { go, useProgressVersion } from '../hooks';
import { APP_VERSION, UPSTREAM_NAME, UPSTREAM_URL } from '../../app/config';

export function HomeScreen(): JSX.Element {
  const t = useT();
  useProgressVersion();
  const state = Progress.getState();

  const rec = Progress.recommendation();
  const recMod = moduleById(rec.moduleId) ?? (MODULES[0] as (typeof MODULES)[number]);
  const recLevel = recMod.levels[rec.levelIdx] ?? (recMod.levels[0] as (typeof recMod.levels)[number]);
  const anyStarted = MODULES.some((mod) => Progress.moduleStarted(mod.id));
  const streak = state.streak;

  return (
    <div className="page">
      <TopBar />
      {streak.current > 0 ? (
        <div className="streak-banner">
          {t('home.streak', { days: streak.current })}
          {streak.best > streak.current ? (
            <span className="muted"> · {t('home.streakBest', { days: streak.best })}</span>
          ) : null}
        </div>
      ) : null}

      <section className="hero-row">
        <button
          type="button"
          className="card continue-card"
          style={moduleColor(recMod.color)}
          onClick={() => go(`#/practice/${rec.moduleId}/${rec.levelIdx}`)}
        >
          <div className="cc-icon">{recMod.icon}</div>
          <div className="cc-text">
            <div className="cc-kicker">{anyStarted ? t('home.continue') : t('home.startHere')}</div>
            <div className="cc-title">
              {t(recMod.titleKey)} · {t(recLevel.nameKey)}
            </div>
            <div className="cc-sub">{t(recLevel.hintKey)}</div>
          </div>
          <Ring pct={Progress.levelProgress(rec.moduleId, rec.levelIdx)} size={48} stroke={5} />
        </button>

        {anyStarted ? (
          <button type="button" className="card daily-card" onClick={() => go('#/daily')}>
            <div className="cc-icon">⚡</div>
            <div className="cc-text">
              <div className="cc-kicker">{t('home.daily')}</div>
              <div className="cc-sub">{t('home.dailySub')}</div>
            </div>
          </button>
        ) : null}
      </section>

      <section className="module-grid">
        {MODULES.map((mod) => {
          const done = Progress.moduleCompletedCount(mod.id);
          const current = Progress.currentLevelIndex(mod.id);
          return (
            <button
              key={mod.id}
              type="button"
              className="card module-card"
              style={moduleColor(mod.color)}
              onClick={() => go(`#/module/${mod.id}`)}
            >
              <div className="mc-head">
                <span className="mc-icon">{mod.icon}</span>
                <span className="mc-title">{t(mod.titleKey)}</span>
                <span className="mc-count">
                  {done}/{mod.levels.length}
                </span>
              </div>
              <div className="mc-blurb">{t(mod.blurbKey)}</div>
              <div className="mc-dots">
                {mod.levels.map((level, index) => {
                  let cls = 'dot';
                  if (Progress.isLevelComplete(mod.id, index)) cls += ' done';
                  else if (index === current && Progress.isLevelUnlocked(mod.id, index)) cls += ' current';
                  else if (!Progress.isLevelUnlocked(mod.id, index)) cls += ' locked';
                  return <span key={level.id} className={cls} />;
                })}
              </div>
            </button>
          );
        })}
      </section>

      <footer className="foot">
        <span>{t('home.footer')} </span>
        <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer">
          {UPSTREAM_NAME}
        </a>
        <span> · v{APP_VERSION}</span>
      </footer>
    </div>
  );
}
