/**
 * 通用小部件：顶部导航与进度圆环。
 *
 * 类名沿用移植过来的 earpath 样式表（styles/global.css）。
 */

import type { CSSProperties, JSX } from 'react';
import { useT } from '../../i18n';

export function TopBar({ active = '' }: { active?: string }): JSX.Element {
  const t = useT();
  const link = (route: string, label: string, key: string): JSX.Element => (
    <a className={active === key ? 'nav-link active' : 'nav-link'} href={route}>
      {label}
    </a>
  );
  return (
    <header className="topbar">
      <a className="logo" href="#/">
        <span className="logo-mark">◖♪</span>
        {t('app.name')}
      </a>
      <nav className="nav">
        {link('#/guide', t('nav.guide'), 'guide')}
        {link('#/stats', t('nav.stats'), 'stats')}
        {link('#/settings', t('nav.settings'), 'settings')}
      </nav>
    </header>
  );
}

/** SVG 进度圆环，pct 取 0..1。 */
export function Ring({ pct, size = 40, stroke = 4 }: { pct: number; size?: number; stroke?: number }): JSX.Element {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--ring-bg)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--mc, var(--accent))"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export const formatPct = (correct: number, answered: number): string =>
  answered > 0 ? `${Math.round((correct / answered) * 100)}%` : '—';

/** 模块配色注入：`--mc` 是自定义属性，TS 的 CSSProperties 不认，这里统一断言一次。 */
export const moduleColor = (color: string): CSSProperties =>
  ({ '--mc': `var(--c-${color})` }) as CSSProperties;
