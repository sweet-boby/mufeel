/**
 * 顶层组件：页面切换 + 会话生命周期。
 *
 * 只有三个页面状态：首页 → 练习中 → 结果页。
 * 任何业务判断都不在这里，这里只决定「现在该显示哪个页面」。
 */

import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { DrillScreen } from './drill-screen';
import { HomeScreen } from './home-screen';
import { ResultScreen } from './result-screen';
import {
  clearRecords,
  createSpecFromChoice,
  useDrill,
  useRecentRecords,
  type DrillSpecChoice,
} from './use-drill';

const DEFAULT_CHOICE: DrillSpecChoice = { noteCount: 3, spanPattern: 'unrestricted' };

export function App(): JSX.Element {
  const [choice, setChoice] = useState<DrillSpecChoice>(DEFAULT_CHOICE);
  const [sessionKey, setSessionKey] = useState(0);
  const [isDrilling, setIsDrilling] = useState(false);
  const recent = useRecentRecords(sessionKey);
  const drill = useDrill();

  const startDrill = useCallback(
    (nextChoice: DrillSpecChoice) => {
      setChoice(nextChoice);
      setSessionKey((key) => key + 1);
      setIsDrilling(true);
      drill.start(createSpecFromChoice(nextChoice));
    },
    [drill],
  );

  const quitDrill = useCallback(() => {
    setIsDrilling(false);
    // 退出练习必须同时重置领域状态：否则 runner 会停在「一局进行中」，
    // 首页再换规格就会被 domain 拒绝，用户看到的现象是「换了规格却没生效」。
    drill.quit();
    setSessionKey((key) => key + 1);
  }, [drill]);

  const restartSameSpec = useCallback(() => {
    setSessionKey((key) => key + 1);
    drill.restartSameSpec();
  }, [drill]);

  const changeSpec = useCallback(() => {
    setIsDrilling(false);
  }, []);

  const wipeHistory = useCallback(() => {
    clearRecords();
    setSessionKey((key) => key + 1);
  }, []);

  const { state } = drill;

  return (
    <div className="app">
      <main className="app-main">
        {!isDrilling ? (
          <HomeScreen
            choice={choice}
            onChange={setChoice}
            recentAccuracy={recent.accuracy}
            recentCount={recent.count}
            onStart={() => startDrill(choice)}
          />
        ) : state.phase === 'finished' && state.summary !== null ? (
          <ResultScreen
            summary={state.summary}
            specLabel={state.specLabel}
            onRestartSameSpec={restartSameSpec}
            onChangeSpec={changeSpec}
            onClearHistory={wipeHistory}
          />
        ) : (
          <DrillScreen
            state={state}
            onTogglePlay={drill.replay}
            onSelectRank={drill.selectRank}
            onProposeRank={drill.proposeRank}
            onSubmit={drill.submit}
            onNext={drill.next}
            onQuit={quitDrill}
          />
        )}
      </main>

      {drill.toast !== null && <div className="toast">{drill.toast}</div>}

      <footer className="app-foot">
        音高排序练习 · 领域核心与界面分离，安卓端可复用同一套规则
      </footer>
    </div>
  );
}
