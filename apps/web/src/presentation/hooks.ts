/**
 * 与浏览器状态接线的小 hook：存档版本号与 hash 路由。
 */

import { useSyncExternalStore } from 'react';
import { useEffect, useState } from 'react';
import { getVersion, subscribe } from '../infrastructure/progress';

/**
 * 订阅存档变化。
 *
 * 快照故意是「版本号」而不是状态对象本身：状态是可变对象（答题热路径不做深拷贝），
 * 用对象当快照会让 React 认为永远没变。
 */
export function useProgressVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

export interface Route {
  view: string;
  a?: string;
  b?: string;
}

function parseHash(): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [view = '', a, b] = parts;
  return { view, ...(a === undefined ? {} : { a }), ...(b === undefined ? {} : { b }) };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = (): void => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(route: string): void {
  location.hash = route;
}
