/**
 * 语言常量单独放一个文件：不依赖 React 的模块（存档、题型生成器）也要用默认语言，
 * 不能让它们为了一个常量去 import 一个 .tsx。
 */

import type { Lang } from './types';

export const LANGUAGES: readonly { id: Lang; label: string }[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
];

/** 产品默认语言：中文。 */
export const DEFAULT_LANG: Lang = 'zh';

export const isLang = (value: unknown): value is Lang => value === 'zh' || value === 'en';

export const htmlLang = (lang: Lang): string => (lang === 'zh' ? 'zh-Hans' : 'en');
