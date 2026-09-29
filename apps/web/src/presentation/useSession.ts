/**
 * 练习会话状态机：一道题的完整生命周期（出题 → 播放 → 作答 → 判分 → 下一题）。
 *
 * 从 earpath-app 的 js/session.js 移植而来，形状从「命令式改 DOM」换成「reducer + 派生渲染」，
 * 但节奏与规则一字未改：首次要点一下才开始播、答完给反馈与对比重放、
 * 关卡达到目标就弹庆祝、Daily 模式固定题数后给小结。
 *
 * 排序题的作答规则仍然全部来自 core：`assignRank` 处理「档位被占」的互换语义（也是「已经选过还能再点」
 * 的实现——填满之后改答案就是一次互换）、`isDraftSubmittable` 决定能不能提交、`judge` 出判分明细——
 * 这里只存草稿。
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  assignRank,
  correctRanks,
  createAnswerDraft,
  isDraftSubmittable,
  type Judgment,
  type RankSequence,
} from '@yuegan/core';
import { MODULES, moduleById } from '../course/curriculum';
import { generate, resetPickState, type Question } from '../questions';
import type { QuestionResult } from '../questions/types';
import { PianoEngineAudioPlayer } from '../infrastructure/audio/core-audio-player';
import { pianoEngine } from '../infrastructure/audio/piano-engine';
import * as Progress from '../infrastructure/progress';
import { useT } from '../i18n';

export type SessionMode = 'level' | 'daily';

export interface SessionConfig {
  mode: SessionMode;
  moduleId?: string;
  levelIdx?: number;
  dailyTotal?: number;
}

interface SessionState {
  q: Question | null;
  answered: boolean;
  result: QuestionResult | null;
  judgment: Judgment | null;
  playing: boolean;
  /** 这一局答了几题、对了几题。 */
  answeredCount: number;
  correctCount: number;
  dailyDone: number;
  overlay: 'none' | 'level' | 'daily';
  /**
   * 这一答完成了本关，但庆祝浮层还没弹出来。
   *
   * 排序题走这条：它的反馈（真实顺序、逐音对照）是这道题最该看的东西，
   * 不该被浮层直接盖住；等用户点「看结果」再弹。
   */
  pendingCelebration: boolean;
  /** 排序题的作答草稿（core 的 AnswerDraft）。 */
  rankDraft: readonly (number | null)[];
  /** 主动重听用掉几次。 */
  replays: number;
  everPlayed: boolean;
  /** 用户点在哪个选项上（用于高亮与对比），以及序列/旋律的中间态。 */
  choicePick: string | null;
  seqPick: readonly (string | null)[];
  melodyPick: readonly number[];
}

type Action =
  | { type: 'question'; q: Question }
  | { type: 'playing'; value: boolean }
  | { type: 'played' }
  | { type: 'answered'; result: QuestionResult; judgment: Judgment | null; justCompleted: boolean }
  | { type: 'choice-pick'; id: string }
  | { type: 'seq-pick'; seq: readonly (string | null)[] }
  | { type: 'melody-pick'; notes: readonly number[] }
  | { type: 'rank-assign'; noteIndex: number; rank: number }
  | { type: 'overlay'; value: SessionState['overlay'] }
  | { type: 'celebrate' }
  | { type: 'daily-done' };

const initialState: SessionState = {
  q: null,
  answered: false,
  result: null,
  judgment: null,
  playing: false,
  answeredCount: 0,
  correctCount: 0,
  dailyDone: 0,
  overlay: 'none',
  pendingCelebration: false,
  rankDraft: [],
  replays: 0,
  everPlayed: false,
  choicePick: null,
  seqPick: [],
  melodyPick: [],
};

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'question':
      return {
        ...initialState,
        // 局内累计的分数要跨题保留
        answeredCount: state.answeredCount,
        correctCount: state.correctCount,
        dailyDone: state.dailyDone,
        q: action.q,
        rankDraft: action.q.kind === 'rank' ? createAnswerDraft(action.q.noteCount) : [],
        // 序列题一开始就要有「每槽都空着」的草稿，否则 fillSlot 找不到第一个空槽
        seqPick: action.q.kind === 'sequence' ? action.q.answerSeq.map(() => null) : [],
      };
    case 'playing':
      return { ...state, playing: action.value };
    case 'played':
      // 首次播放只负责「解锁作答」；之后每一次主动播放才算重听（排序题的 3 次上限按这个算）。
      return {
        ...state,
        everPlayed: true,
        replays: state.everPlayed ? state.replays + 1 : state.replays,
      };
    case 'choice-pick':
      return { ...state, choicePick: action.id };
    case 'seq-pick':
      return { ...state, seqPick: action.seq };
    case 'melody-pick':
      return { ...state, melodyPick: action.notes };
    case 'rank-assign':
      // 在 reducer 里基于**最新**草稿计算：连点两个格子时，第二次不会再拿渲染期的旧草稿做基准。
      return { ...state, rankDraft: assignRank(state.rankDraft, action.noteIndex, action.rank) };
    case 'answered': {
      // 排序题的反馈信息量最大（真实顺序 + 逐音你填/正确/真实音高），
      // 所以本关达成也不立刻盖浮层，改成等用户点「看结果」。
      const deferCelebration = action.justCompleted && state.q?.kind === 'rank';
      return {
        ...state,
        answered: true,
        result: action.result,
        judgment: action.judgment,
        answeredCount: state.answeredCount + 1,
        correctCount: state.correctCount + (action.result.correct ? 1 : 0),
        dailyDone: state.dailyDone + 1,
        pendingCelebration: deferCelebration,
        overlay: action.justCompleted && !deferCelebration ? 'level' : state.overlay,
      };
    }
    case 'celebrate':
      return { ...state, overlay: 'level', pendingCelebration: false };
    case 'daily-done':
      return { ...state, overlay: 'daily' };
    case 'overlay':
      return { ...state, overlay: action.value };
  }
}

export interface Session {
  state: SessionState;
  question: Question | null;
  /** 音频是否就绪；false 时界面显示「准备音色」。 */
  audioReady: boolean;
  loadProgress: number;
  /** 音频就绪后由界面调用，出第一题并自动播放。 */
  start: () => void;
  started: boolean;
  play: () => void;
  replayDisabled: boolean;
  replaysLeft: number | null;
  choose: (id: string) => void;
  fillSlot: (id: string) => void;
  undoSlot: () => void;
  playMelodyNote: (midi: number) => void;
  undoMelodyNote: () => void;
  assign: (noteIndex: number, rank: number) => void;
  submitRank: () => void;
  canSubmitRank: boolean;
  next: () => void;
  keepPracticing: () => void;
  goalText: string | null;
}

export function useSession(cfg: SessionConfig): Session {
  const t = useT();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [audioReady, setAudioReady] = useState(() => pianoEngine.isReady());
  const [loadProgress, setLoadProgress] = useState(() => (pianoEngine.isReady() ? 1 : 0));
  const [started, setStarted] = useState(false);
  const autoTimer = useRef<number | null>(null);

  // 排序题的播放走 core 的 AudioPlayer 端口；其余题型直接给采样引擎事件（需要和弦与终止式）。
  const corePlayer = useMemo(() => new PianoEngineAudioPlayer(), []);

  const ctx = useMemo(
    () => ({
      t,
      weight: Progress.itemWeight,
      play: (events: Parameters<typeof pianoEngine.playEvents>[0]) => pianoEngine.playEvents(events),
      playPitches: (pitches: Parameters<typeof corePlayer.playSequence>[0], timing?: Parameters<typeof corePlayer.playSequence>[1]) =>
        corePlayer.playSequence(pitches, timing),
      settings: {
        chordStyle: Progress.getState().settings.chordStyle,
        degreeLabels: Progress.getState().settings.degreeLabels,
        melodyTempo: Progress.getState().settings.melodyTempo,
      },
    }),
    [t],
  );

  const clearAuto = useCallback(() => {
    if (autoTimer.current !== null) {
      window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  }, []);

  /** 出下一题；第一题之前不会自动播（用户还没点过，浏览器也不让出声）。 */
  const nextQuestion = useCallback(() => {
    clearAuto();
    const moduleId =
      cfg.mode === 'level'
        ? (cfg.moduleId ?? 'pitch')
        : pickDailyModule();
    const levelIdx =
      cfg.mode === 'level'
        ? (cfg.levelIdx ?? 0)
        : Progress.currentLevelIndex(moduleId);
    const question = generate(moduleId, levelIdx, ctx);
    if (question === null) {
      return;
    }
    dispatch({ type: 'question', q: question });
  }, [cfg.levelIdx, cfg.mode, cfg.moduleId, clearAuto, ctx]);

  const play = useCallback(() => {
    const question = state.q;
    if (question === null || state.playing) {
      return;
    }
    // 重听上限对所有入口生效（按钮、键盘 R、自动播放之后的每一次主动播放）：
    // 排序题的规定来自 core 的规格，界面不额外放宽。
    if (
      question.kind === 'rank' &&
      !state.answered &&
      state.everPlayed &&
      state.replays >= question.replayLimit
    ) {
      return;
    }
    dispatch({ type: 'playing', value: true });
    dispatch({ type: 'played' });
    void question
      .play()
      .catch((error: unknown) => console.warn('yuegan: 播放失败', error))
      .finally(() => dispatch({ type: 'playing', value: false }));
  }, [state.answered, state.everPlayed, state.playing, state.q, state.replays]);

  // 音频就绪且用户点过「开始」之后，才出第一题并自动播放。
  useEffect(() => {
    if (started && audioReady && state.q === null) {
      resetPickState();
      nextQuestion();
    }
  }, [audioReady, nextQuestion, started, state.q]);

  useEffect(() => {
    if (started && audioReady && state.q !== null && !state.everPlayed && !state.playing) {
      play();
    }
    // 只在「新题 + 已开局」时自动播一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.q, started, audioReady]);

  // 每日混合练满固定题数后弹小结（关卡练习没有题数上限，不适用）。
  useEffect(() => {
    if (cfg.mode !== 'daily' || state.overlay !== 'none' || state.dailyDone === 0) {
      return;
    }
    if (state.dailyDone >= (cfg.dailyTotal ?? 15)) {
      dispatch({ type: 'daily-done' });
    }
  }, [cfg.dailyTotal, cfg.mode, state.dailyDone, state.overlay]);

  const finish = useCallback(
    (result: QuestionResult, judgment: Judgment | null) => {
      const question = state.q;
      if (question === null) {
        return;
      }
      const { justCompleted } = Progress.recordAnswer(
        question.moduleId,
        question.levelIdx,
        result.itemResults,
        result.correct,
        result.confusion,
      );
      dispatch({ type: 'answered', result, judgment, justCompleted });
    },
    [state.q],
  );

  const choose = useCallback(
    (id: string) => {
      const question = state.q;
      if (question === null || question.kind !== 'choice' || state.answered || !state.everPlayed) {
        return;
      }
      dispatch({ type: 'choice-pick', id });
      finish(question.grade(id), null);
    },
    [finish, state.answered, state.everPlayed, state.q],
  );

  const submitSequence = useCallback(
    (seq: readonly (string | null)[]) => {
      const question = state.q;
      if (question === null || question.kind !== 'sequence') {
        return;
      }
      finish(question.grade(seq), null);
    },
    [finish, state.q],
  );

  const fillSlot = useCallback(
    (id: string) => {
      const question = state.q;
      if (question === null || question.kind !== 'sequence' || state.answered || !state.everPlayed) {
        return;
      }
      const index = state.seqPick.findIndex((value) => value === null);
      if (index === -1) {
        return;
      }
      const next = state.seqPick.map((value, i) => (i === index ? id : value));
      dispatch({ type: 'seq-pick', seq: next });
      if (!next.includes(null)) {
        submitSequence(next);
      }
    },
    [state.answered, state.everPlayed, state.q, state.seqPick, submitSequence],
  );

  const undoSlot = useCallback(() => {
    if (state.answered || state.q?.kind !== 'sequence') {
      return;
    }
    const next = [...state.seqPick];
    for (let i = next.length - 1; i >= 0; i -= 1) {
      if (next[i] !== null) {
        next[i] = null;
        dispatch({ type: 'seq-pick', seq: next });
        return;
      }
    }
  }, [state.answered, state.q, state.seqPick]);

  const submitMelody = useCallback(
    (notes: readonly number[]) => {
      const question = state.q;
      if (question === null || question.kind !== 'melody') {
        return;
      }
      finish(question.grade(notes), null);
    },
    [finish, state.q],
  );

  const playMelodyNote = useCallback(
    (midi: number) => {
      const question = state.q;
      if (question === null || question.kind !== 'melody' || state.answered || !state.everPlayed) {
        return;
      }
      if (state.melodyPick.length >= question.targetMidis.length) {
        return;
      }
      const next = [...state.melodyPick, midi];
      dispatch({ type: 'melody-pick', notes: next });
      if (next.length === question.targetMidis.length) {
        submitMelody(next);
      }
    },
    [state.answered, state.everPlayed, state.melodyPick, state.q, submitMelody],
  );

  const undoMelodyNote = useCallback(() => {
    if (state.answered || state.q?.kind !== 'melody') {
      return;
    }
    dispatch({ type: 'melody-pick', notes: state.melodyPick.slice(0, -1) });
  }, [state.answered, state.melodyPick, state.q]);

  const assign = useCallback(
    (noteIndex: number, rank: number) => {
      const current = state.q;
      if (current === null || current.kind !== 'rank' || state.answered || !state.everPlayed) {
        return;
      }
      // 档位被占用时的互换/置空语义由 core 的 assignRank 决定，这里只转发。
      // 界面不拦「已经被别人占着」的档位：那样填满之后就没法改答案了。
      dispatch({ type: 'rank-assign', noteIndex, rank });
    },
    [state.answered, state.everPlayed, state.q],
  );

  const question = state.q;
  const canSubmitRank =
    question !== null &&
    question.kind === 'rank' &&
    isDraftSubmittable(state.rankDraft, question.noteCount);

  const submitRank = useCallback(() => {
    const current = state.q;
    if (current === null || current.kind !== 'rank' || state.answered) {
      return;
    }
    if (!isDraftSubmittable(state.rankDraft, current.noteCount)) {
      return;
    }
    const { result, judgment } = current.grade(state.rankDraft as RankSequence);
    finish(result, judgment);
  }, [finish, state.answered, state.q, state.rankDraft]);

  const next = useCallback(() => {
    clearAuto();
    // 排序题把庆祝留到这一刻：用户看完反馈点「看结果」，才弹关卡完成浮层。
    if (state.pendingCelebration) {
      dispatch({ type: 'celebrate' });
      return;
    }
    dispatch({ type: 'overlay', value: 'none' });
    nextQuestion();
  }, [clearAuto, nextQuestion, state.pendingCelebration]);

  const keepPracticing = useCallback(() => {
    clearAuto();
    dispatch({ type: 'overlay', value: 'none' });
  }, [clearAuto]);

  // 答对且开了自动前进时，短延迟后自己走。
  useEffect(() => {
    if (
      state.answered &&
      state.overlay === 'none' &&
      state.result?.correct === true &&
      // 排序题不自动走：它的反馈要读，读多久由用户决定（设置里的「自动下一题」对其它题型照常生效）
      state.q?.kind !== 'rank' &&
      !state.pendingCelebration &&
      Progress.getState().settings.autoAdvance
    ) {
      autoTimer.current = window.setTimeout(() => {
        dispatch({ type: 'overlay', value: 'none' });
        nextQuestion();
      }, 1100);
      return clearAuto;
    }
    return undefined;
  }, [clearAuto, nextQuestion, state.answered, state.overlay, state.pendingCelebration, state.q, state.result]);

  useEffect(() => () => clearAuto(), [clearAuto]);

  // 开发期后门：让浏览器控制台与自动化脚本读到**真实领域状态**，而不是从 DOM 反推。
  // `truth()` 给出当前排序题的真实音高与正确答案（等于旧版的 window.__yueganRunner.getState().forge）。
  const devState = useRef<{
    question: Question | null;
    answered: boolean;
    rankDraft: readonly (number | null)[];
    judgment: Judgment | null;
  }>({ question: null, answered: false, rankDraft: [], judgment: null });
  devState.current = {
    question,
    answered: state.answered,
    rankDraft: state.rankDraft,
    judgment: state.judgment,
  };
  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    const handle = {
      getState: () => devState.current,
      /** 当前排序题的真实音高与正确答案（等于旧版的 window.__yueganRunner.getState().forge）。 */
      truth: () => {
        const current = devState.current.question;
        if (current === null || current.kind !== 'rank') {
          return null;
        }
        return { pitches: current.exercise.pitches, correct: correctRanks(current.exercise) };
      },
    };
    (window as unknown as { __yueganSession?: unknown }).__yueganSession = handle;
    return () => {
      delete (window as unknown as { __yueganSession?: unknown }).__yueganSession;
    };
    // 只在挂载时注册一次；handle 内部通过 devState 读最新值，避免闭包拿到首次渲染的状态。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replaysLeft =
    question !== null && question.kind === 'rank' ? question.replayLimit - state.replays : null;

  const goalText = useMemo(() => {
    if (cfg.mode === 'daily' || cfg.moduleId === undefined || cfg.levelIdx === undefined) {
      return null;
    }
    const mod = moduleById(cfg.moduleId);
    if (mod === undefined) {
      return null;
    }
    const stats = Progress.levelStats(cfg.moduleId, cfg.levelIdx);
    if (stats.completedAt !== null) {
      return t('practice.freePractice');
    }
    const got = stats.recent.slice(-mod.window).reduce((a, b) => a + b, 0);
    return t('practice.goal', { need: mod.need, window: mod.window, got });
  }, [cfg.levelIdx, cfg.mode, cfg.moduleId, state.answeredCount, t]);

  return {
    state,
    question,
    audioReady,
    loadProgress,
    started,
    start: () => {
      setStarted(true);
      if (pianoEngine.isReady()) {
        setAudioReady(true);
        return;
      }
      void pianoEngine
        .load(setLoadProgress)
        .then(() => setAudioReady(true))
        .catch((error: unknown) => console.warn('yuegan: 采样加载失败', error));
    },
    play,
    replayDisabled: state.playing || (replaysLeft !== null && replaysLeft <= 0 && !state.answered),
    replaysLeft,
    choose,
    fillSlot,
    undoSlot,
    playMelodyNote,
    undoMelodyNote,
    assign,
    submitRank,
    canSubmitRank,
    next,
    keepPracticing,
    goalText,
  };
}

/** Daily 模式：只在已经开始过的模块里随机挑一个。 */
function pickDailyModule(): string {
  const started = MODULES.filter((mod) => Progress.moduleStarted(mod.id));
  if (started.length === 0) {
    return 'pitch';
  }
  const picked = started[Math.floor(Math.random() * started.length)];
  return picked?.id ?? 'pitch';
}
