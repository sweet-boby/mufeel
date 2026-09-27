/**
 * 指南页：怎么练得更快、各模块的听法、音程参考曲目、以及本项目的来历与隐私说明。
 */

import type { JSX } from 'react';
import { MODULES } from '../../domain/curriculum';
import { INTERVALS } from '../../domain/theory';
import { useT } from '../../i18n';
import { TopBar, moduleColor } from '../components/Chrome';
import { UPSTREAM_NAME, UPSTREAM_URL } from '../../app/config';

export function GuideScreen(): JSX.Element {
  const t = useT();

  const songRows = Object.entries(INTERVALS)
    .filter(([, interval]) => interval.songKeys?.asc !== undefined || interval.songKeys?.desc !== undefined)
    .map(([id, interval]) => (
      <tr key={id}>
        <td>
          <strong>{t(interval.nameKey)}</strong>
        </td>
        <td>{interval.songKeys?.asc === undefined ? '—' : t(interval.songKeys.asc)}</td>
        <td>{interval.songKeys?.desc === undefined ? '—' : t(interval.songKeys.desc)}</td>
      </tr>
    ));

  return (
    <div className="page guide">
      <TopBar active="guide" />
      <h1>{t('guide.title')}</h1>
      <p>{t('guide.intro')}</p>

      <div className="card tipcard">
        <h3>{t('guide.sing.title')}</h3>
        <p>{t('guide.sing.body')}</p>
      </div>
      <div className="card tipcard">
        <h3>{t('guide.compare.title')}</h3>
        <p>{t('guide.compare.body')}</p>
      </div>
      <div className="card tipcard">
        <h3>{t('guide.stuck.title')}</h3>
        <p>{t('guide.stuck.body')}</p>
      </div>

      <h2>{t('guide.byModule')}</h2>
      {MODULES.map((mod) => (
        <div key={mod.id} className="card tipcard" style={moduleColor(mod.color)}>
          <h3>
            {mod.icon} {t(mod.titleKey)}
          </h3>
          <p>{t(mod.tipKey)}</p>
        </div>
      ))}

      <h2>{t('guide.songs')}</h2>
      <p className="muted">{t('guide.songsNote')}</p>
      <table className="songs">
        <thead>
          <tr>
            <th>{t('guide.tableInterval')}</th>
            <th>{t('guide.tableAsc')}</th>
            <th>{t('guide.tableDesc')}</th>
          </tr>
        </thead>
        <tbody>{songRows}</tbody>
      </table>

      <h2>{t('guide.about')}</h2>
      <p className="muted">
        {t('guide.aboutBody')}{' '}
        <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer">
          {UPSTREAM_NAME}
        </a>
        。
      </p>
      <p className="muted">{t('guide.privacy')}</p>
    </div>
  );
}
