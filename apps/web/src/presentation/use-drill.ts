/**
 * React 与 DrillRunner 之间的唯一接缝。
 *
 * 界面的所有业务状态都来自 core 产出的 view state；
 * React 只负责渲染它、以及把用户操作翻译成 runner 的命令。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_AUDIO_CONFIG,
  DrillRunner,
  createDrillSpec,
  type DrillRunnerEvent,
  type DrillSpec,
  type DrillViewState,
  type PitchSpanPattern,
} from '@yuegan/core';
import { WebAudioPianoPlayer } from '../infrastructure/web-audio-piano-player';
import { LocalStorageDrillRecordRepository } from '../infrastructure/local-storage-drill-record-repository';

export interface DrillControls {
  state: DrillViewState;
  start: (spec?: DrillSpec) => void;
  replay: () => void;
  selectRank: (noteIndex: number, rank: number) => void;
  proposeRank: (noteIndex: number, rank: number) => void;
  submit: () => void;
  next: () => void;
  restartSameSpec: () => void;
  /**
   * 退出当前练习，回到「没在练习」的状态。
   *
   * 界面从练习页回到首页时必须调用它：只切页面不重置 runner，会留下一局「进行中」
   * 的残留状态——首页换规格会被 domain 正确拒绝，用户却只看到自己选的规格没生效。
   */
  quit: () => void;
  toast: string | null;
}

/** 首页选择的练习规格（音数 + 难度）。 */
export interface DrillSpecChoice {
  noteCount: number;
  spanPattern: PitchSpanPattern;
}

export function createSpecFromChoice(choice: DrillSpecChoice): DrillSpec {
  return createDrillSpec({ noteCount: choice.noteCount, spanPattern: choice.spanPattern });
}

/**
 * 把 DrillRunner 接到 React 上。runner 在一局练习的生命周期内复用，
 * 规格通过 ref 传入（`start(spec)` 时读取），因此换规格不需要重建 runner。
 */
export function useDrill(): DrillControls {
  const player = useMemo(() => new WebAudioPianoPlayer(), []);
  const repository = useMemo(() => new LocalStorageDrillRecordRepository(), []);

  const [spec, setSpec] = useState<DrillSpec>(() =>
    createDrillSpec({ noteCount: 3, spanPattern: 'unrestricted' }),
  );

  const runner = useMemo(
    () =>
      new DrillRunner(spec, {
        audioPlayer: player,
        audioTiming: DEFAULT_AUDIO_CONFIG.playback,
        recordRepository: repository,
      }),
    // 只在挂载时创建：规格变化通过 start() 命令传入，避免中途换掉整个 runner。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player, repository],
  );

  const [state, setState] = useState<DrillViewState>(() => runner.getState());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = runner.subscribe((event: DrillRunnerEvent) => {
      setState(event.state);
      if (event.type === 'error' && event.message !== undefined) {
        setToast(event.message);
      }
    });
    // 开发期把 runner 挂到 window，方便在浏览器控制台/自动化里直接读领域状态，
    // 而不是从 DOM 反推（这也是排查「界面显示和真实状态不一致」类问题的关键手段）。
    if (import.meta.env.DEV) {
      (window as unknown as { __yueganRunner?: DrillRunner }).__yueganRunner = runner;
    }
    return () => {
      unsubscribe();
      void runner.destroy();
    };
  }, [runner]);

  useEffect(() => {
    if (toast === null) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const start = useCallback(
    (nextSpec?: DrillSpec) => {
      const effective = nextSpec ?? spec;
      setSpec(effective);
      runner.setSpec(effective);
      void runner.start();
    },
    [runner, spec],
  );

  return {
    state,
    start,
    replay: useCallback(() => void runner.play(), [runner]),
    selectRank: useCallback(
      (noteIndex: number, rank: number) => runner.selectRank(noteIndex, rank),
      [runner],
    ),
    proposeRank: useCallback(
      (noteIndex: number, rank: number) => runner.proposeRank(noteIndex, rank),
      [runner],
    ),
    submit: useCallback(() => void runner.submit(), [runner]),
    next: useCallback(() => void runner.next(), [runner]),
    restartSameSpec: useCallback(() => {
      void runner.reset().then(() => runner.start());
    }, [runner]),
    quit: useCallback(() => {
      void runner.reset();
    }, [runner]),
    toast,
  };
}

/** 读最近一局的成绩，用于首页显示进步。version 变化时重新读取。 */
export function useRecentRecords(version = 0, limit = 20): { accuracy: number | null; count: number } {
  const [records, setRecords] = useState<{ accuracy: number | null; count: number }>({
    accuracy: null,
    count: 0,
  });

  useEffect(() => {
    const repository = new LocalStorageDrillRecordRepository();
    void repository.listRecent(limit).then((items) => {
      const last = items[0];
      setRecords({
        accuracy:
          last === undefined || last.totalCount === 0
            ? null
            : Math.round((last.correctCount / last.totalCount) * 100),
        count: items.length,
      });
    });
  }, [limit, version]);

  return records;
}

export function clearRecords(): void {
  void new LocalStorageDrillRecordRepository().clear();
}
