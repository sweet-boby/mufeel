/**
 * 设置页：语言、音量、出题与播放偏好、以及本地存档的导入导出。
 */

import { useRef, type JSX } from 'react';
import { LANGUAGES, useLang, useT } from '../../i18n';
import type { Lang } from '../../i18n/types';
import * as Progress from '../../infrastructure/progress';
import { pianoEngine } from '../../infrastructure/audio/piano-engine';
import { TopBar } from '../components/Chrome';
import { go, useProgressVersion } from '../hooks';
import { UPSTREAM_URL } from '../../app/config';

export function SettingsScreen(): JSX.Element {
  const t = useT();
  const { lang, setLang } = useLang();
  useProgressVersion();
  const settings = Progress.getState().settings;
  const fileRef = useRef<HTMLInputElement>(null);

  const row = (label: string, desc: string, control: JSX.Element): JSX.Element => (
    <div className="card setting-row">
      <div className="set-main">
        <div className="set-label">{label}</div>
        {desc !== '' ? <div className="tiny muted">{desc}</div> : null}
      </div>
      {control}
    </div>
  );

  const select = (
    value: string,
    options: readonly (readonly [string, string])[],
    onChange: (value: string) => void,
  ): JSX.Element => (
    <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );

  const toggle = (value: boolean, onChange: (next: boolean) => void): JSX.Element => (
    <button
      type="button"
      className={value ? 'toggle on' : 'toggle'}
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
    >
      <span className="knob" />
    </button>
  );

  return (
    <div className="page">
      <TopBar active="settings" />
      <h1>{t('settings.title')}</h1>

      {row(
        t('settings.language'),
        t('settings.languageDesc'),
        select(
          lang,
          LANGUAGES.map((item) => [item.id, item.label] as const),
          (value) => setLang(value as Lang),
        ),
      )}

      {row(
        t('settings.volume'),
        t('settings.volumeDesc'),
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          className="slider"
          value={settings.volume}
          onChange={(event) => {
            const volume = Number(event.target.value);
            Progress.updateSettings({ volume });
            pianoEngine.setVolume(volume);
          }}
          onPointerUp={() => {
            pianoEngine.unlock();
            void pianoEngine.playEvents([{ midi: 60, at: 0, dur: 0.4 }]);
          }}
        />,
      )}

      {row(
        t('settings.freeRoam'),
        t('settings.freeRoamDesc'),
        toggle(settings.freeRoam, (value) => Progress.updateSettings({ freeRoam: value })),
      )}

      {row(
        t('settings.autoAdvance'),
        t('settings.autoAdvanceDesc'),
        toggle(settings.autoAdvance, (value) => Progress.updateSettings({ autoAdvance: value })),
      )}

      {row(
        t('settings.chordStyle'),
        t('settings.chordStyleDesc'),
        select(
          settings.chordStyle,
          [
            ['block', t('settings.chordStyle.block')],
            ['block+arp', t('settings.chordStyle.blockArp')],
            ['arp', t('settings.chordStyle.arp')],
          ],
          (value) =>
            Progress.updateSettings({ chordStyle: value as 'block' | 'block+arp' | 'arp' }),
        ),
      )}

      {row(
        t('settings.degreeLabels'),
        t('settings.degreeLabelsDesc'),
        select(
          settings.degreeLabels,
          [
            ['solfege', t('settings.degreeLabels.solfege')],
            ['number', t('settings.degreeLabels.number')],
          ],
          (value) => Progress.updateSettings({ degreeLabels: value as 'solfege' | 'number' }),
        ),
      )}

      {row(
        t('settings.melodyTempo'),
        t('settings.melodyTempoDesc'),
        select(
          String(settings.melodyTempo),
          [
            ['0.7', t('settings.melodyTempo.relaxed')],
            ['0.55', t('settings.melodyTempo.medium')],
            ['0.42', t('settings.melodyTempo.brisk')],
          ],
          (value) => Progress.updateSettings({ melodyTempo: Number(value) }),
        ),
      )}

      <h2>{t('settings.data')}</h2>

      {row(
        t('settings.export'),
        t('settings.exportDesc'),
        <button
          type="button"
          className="btn"
          onClick={() => {
            const blob = new Blob([Progress.exportJSON()], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `yuegan-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
          }}
        >
          {t('settings.exportAction')}
        </button>,
      )}

      {row(
        t('settings.import'),
        t('settings.importDesc'),
        <>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            {t('settings.importAction')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file === undefined) return;
              try {
                Progress.importJSON(await file.text());
                window.alert(t('settings.importDone'));
                go('#/');
              } catch {
                window.alert(t('settings.importFailed'));
              }
            }}
          />
        </>,
      )}

      {row(
        t('settings.reset'),
        t('settings.resetDesc'),
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (window.confirm(t('settings.resetConfirm'))) {
              Progress.resetAll();
              go('#/');
            }
          }}
        >
          {t('settings.resetAction')}
        </button>,
      )}

      <p className="tiny muted">
        {t('settings.upstream')}{' '}
        <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer">
          abeage1/earpath-app
        </a>
      </p>
    </div>
  );
}
