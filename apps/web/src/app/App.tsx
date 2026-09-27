/**
 * 应用外壳：hash 路由 + 入门引导浮层。
 *
 * 路由表（全部是 hash，静态托管不需要任何服务端配置）：
 *   #/                        首页
 *   #/module/:id              模块页
 *   #/practice/:id/:level     练习页
 *   #/daily                   每日混合
 *   #/stats  #/settings  #/guide
 */

import { useEffect, useState, type JSX } from 'react';
import * as Progress from '../infrastructure/progress';
import { OnboardingOverlay } from '../presentation/components/OnboardingOverlay';
import { useHashRoute, useProgressVersion } from '../presentation/hooks';
import { DailyScreen, PracticeScreen } from '../presentation/screens/PracticeScreen';
import { GuideScreen } from '../presentation/screens/GuideScreen';
import { HomeScreen } from '../presentation/screens/HomeScreen';
import { ModuleScreen } from '../presentation/screens/ModuleScreen';
import { SettingsScreen } from '../presentation/screens/SettingsScreen';
import { StatsScreen } from '../presentation/screens/StatsScreen';

export function App(): JSX.Element {
  useProgressVersion();
  const route = useHashRoute();
  const [showOnboarding, setShowOnboarding] = useState(() => !Progress.getState().onboarded);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.view, route.a, route.b]);

  let screen: JSX.Element;
  switch (route.view) {
    case 'module':
      screen = <ModuleScreen moduleId={route.a ?? ''} />;
      break;
    case 'practice':
      screen = <PracticeScreen moduleId={route.a ?? ''} levelIdx={Number(route.b ?? '0')} />;
      break;
    case 'daily':
      screen = <DailyScreen />;
      break;
    case 'stats':
      screen = <StatsScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'guide':
      screen = <GuideScreen />;
      break;
    default:
      screen = <HomeScreen />;
  }

  return (
    <>
      {screen}
      {showOnboarding ? <OnboardingOverlay onDone={() => setShowOnboarding(false)} /> : null}
    </>
  );
}
