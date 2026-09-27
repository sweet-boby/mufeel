/**
 * 翻译函数本体（不含 JSX，便于测试直接引用）。
 */

import { en } from './en';
import { zh } from './zh';
import type { Dict, Lang, Params, TFunc } from './types';

export const DICTS: Record<Lang, Dict> = { zh, en };

export function translate(lang: Lang, key: string, params?: Params): string {
  const text = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (params === undefined) {
    return text;
  }
  let out = text;
  for (const [name, value] of Object.entries(params)) {
    out = out.split(`{${name}}`).join(String(value));
  }
  return out;
}

export function translator(lang: Lang): TFunc {
  return (key, params) => translate(lang, key, params);
}

/** 文案里出现过的插值占位符，测试用。 */
export const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string);
