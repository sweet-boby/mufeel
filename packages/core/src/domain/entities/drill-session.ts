/**
 * 一局练习（DrillSession）：一个规格 + 一组题目 + 一组作答。
 *
 * 它是纯数据 + 纯函数，不负责播放音频、不负责计时——那些是应用层的事。
 */

import type { Answer } from './answer';
import type { DrillSpec } from './drill-spec';
import type { Exercise } from './exercise';
import type { Judgment } from './judgment';

export interface DrillAttempt {
  readonly answer: Answer;
  readonly judgment: Judgment;
  /** 这道题用户主动重听了几次。 */
  readonly replayCount: number;
}

export interface DrillSession {
  readonly id: string;
  readonly spec: DrillSpec;
  readonly exercises: readonly Exercise[];
  readonly attempts: readonly DrillAttempt[];
}

export function createDrillSession(
  id: string,
  spec: DrillSpec,
  exercises: readonly Exercise[],
): DrillSession {
  return { id, spec, exercises, attempts: [] };
}

export function recordAttempt(session: DrillSession, attempt: DrillAttempt): DrillSession {
  return { ...session, attempts: [...session.attempts, attempt] };
}

/** 已作答的题数。 */
export function answeredCount(session: DrillSession): number {
  return session.attempts.length;
}

/** 当前正在做第几题（1-based）。 */
export function currentExerciseNumber(session: DrillSession): number {
  return Math.min(answeredCount(session) + 1, session.exercises.length);
}

export function currentExercise(session: DrillSession): Exercise | null {
  return session.exercises[answeredCount(session)] ?? null;
}

export function isComplete(session: DrillSession): boolean {
  return answeredCount(session) >= session.exercises.length;
}

export function correctCount(session: DrillSession): number {
  return session.attempts.filter((attempt) => attempt.judgment.isCorrect).length;
}

/** 正确率，0–1；还没答题时返回 0。 */
export function accuracy(session: DrillSession): number {
  if (session.attempts.length === 0) {
    return 0;
  }
  return correctCount(session) / session.attempts.length;
}

/** 逐题明细，供结果页与历史记录使用。 */
export interface DrillSummaryItem {
  readonly exercise: Exercise;
  readonly answer: Answer;
  readonly judgment: Judgment;
  readonly replayCount: number;
}

export function summarize(session: DrillSession): readonly DrillSummaryItem[] {
  return session.attempts.map((attempt, index) => ({
    exercise: session.exercises[index] as Exercise,
    answer: attempt.answer,
    judgment: attempt.judgment,
    replayCount: attempt.replayCount,
  }));
}
