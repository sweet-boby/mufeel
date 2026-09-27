/**
 * 入门引导：选一条起点，预解锁对应的关卡。
 *
 * 有基础的人不必从头刷「比高低」；但 Pitch 模块现在不只是比高低，
 * 所以「我懂一点」只解锁前四关，真正的排序关卡要靠「我耳朵不错」才跳过。
 */

import type { JSX } from 'react';
import { ONBOARDING_PATHS, type OnboardingPathId } from '../../domain/curriculum';
import { useT } from '../../i18n';
import * as Progress from '../../infrastructure/progress';

export function OnboardingOverlay({ onDone }: { onDone: () => void }): JSX.Element {
  const t = useT();
  return (
    <div className="overlay">
      <div className="onboard">
        <div className="onboard-logo">◖♪</div>
        <h1>{t('onboarding.title')}</h1>
        <p className="muted">{t('onboarding.sub')}</p>
        <div className="onboard-paths">
          {(Object.keys(ONBOARDING_PATHS) as OnboardingPathId[]).map((key) => {
            const path = ONBOARDING_PATHS[key];
            return (
              <button
                key={key}
                type="button"
                className="card path-card"
                onClick={() => {
                  Progress.applyOnboarding({ ...path.unlocks });
                  onDone();
                }}
              >
                <div className="path-label">{t(path.labelKey)}</div>
                <div className="path-desc">{t(path.descKey)}</div>
              </button>
            );
          })}
        </div>
        <p className="tiny muted">{t('onboarding.note')}</p>
      </div>
    </div>
  );
}
