/**
 * i18n 运行时：语言状态、翻译函数与 React 接线。
 *
 * 默认中文，可在设置里切到 English。所有界面文案都必须经过这里——
 * 组件里出现硬编码的中文/英文句子就算破了这条约定（i18n.test.ts 会扫）。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { DEFAULT_LANG, htmlLang } from './languages';
import { translator } from './translate';
import type { Lang, TFunc } from './types';

export type { Dict, Lang, Params, TFunc } from './types';
export { DEFAULT_LANG, LANGUAGES, isLang } from './languages';
export { DICTS, translate } from './translate';

interface I18nValue {
  lang: Lang;
  t: TFunc;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  initialLang = DEFAULT_LANG,
  onLangChange,
  children,
}: {
  initialLang?: Lang;
  /** 语言变化时回调（用于写进设置存档）。 */
  onLangChange?: (lang: Lang) => void;
  children: ReactNode;
}): JSX.Element {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      onLangChange?.(next);
    },
    [onLangChange],
  );

  useEffect(() => {
    // 让浏览器与读屏知道当前页面语言，也影响字体的字形选择。
    document.documentElement.lang = htmlLang(lang);
  }, [lang]);

  const value = useMemo<I18nValue>(() => ({ lang, t: translator(lang), setLang }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n 必须在 <I18nProvider> 内使用');
  }
  return value;
}

/** 组件里最常用的入口：`const t = useT()`。 */
export function useT(): TFunc {
  return useI18n().t;
}

export function useLang(): { lang: Lang; setLang: (lang: Lang) => void } {
  const { lang, setLang } = useI18n();
  return { lang, setLang };
}
