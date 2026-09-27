/**
 * 界面视图模型：应用层唯一对外暴露的数据形状。
 *
 * 这一层之所以存在，是为了让 React 只负责「渲染 state」和「调用命令」，
 * 而不自己推算任何业务规则（哪个档位被占用、能不能提交、还能听几次……）。
 */

import type { DrillSpec } from '../domain/entities/drill-spec';
import { describeDrillSpec } from '../domain/entities/drill-spec';
import { accuracy, answeredCount, correctCount, summarize } from '../domain/entities/drill-session';
import type { Exercise } from '../domain/entities/exercise';
import { correctRanks } from '../domain/entities/exercise';
import type { Judgment } from '../domain/entities/judgment';
import type { Interval } from '../domain/value-objects/interval';
import { intervalBetween, spanOf } from '../domain/value-objects/interval';
import type { NoteName } from '../domain/value-objects/note-name';
import { pitchToNoteName } from '../domain/value-objects/note-name';
import type { Rank } from '../domain/value-objects/rank';
import type { DrillSession } from '../domain/entities/drill-session';

export type DrillPhase =
  | 'idle'
  | 'loading-audio'
  | 'listening'
  | 'answering'
  | 'revealed'
  | 'finished';

export interface SliderOptionView {
  readonly rank: Rank;
  readonly label: string;
  /** 已确认选中的档位。 */
  readonly isSelected: boolean;
  /** 滑块停在这一档但还没确认（指针位置）。 */
  readonly isProposed: boolean;
  /** 已被别的滑块占用，界面上应禁用。 */
  readonly isTakenByOther: boolean;
}

export interface NoteFeedbackView {
  readonly noteIndex: number;
  readonly answeredRank: Rank | null;
  readonly correctRank: Rank;
  readonly isCorrect: boolean;
  readonly noteName: NoteName;
  readonly intervalFromPrevious: Interval | null;
}

export interface NoteView {
  readonly noteIndex: number;
  /** 已确认选中的档位；null 表示这个音还没作答。 */
  readonly selectedRank: Rank | null;
  /**
   * 滑块应该显示在这个档位上。
   * 原生 range 控件没有「空值」，所以未作答时给一个显示用的默认位置，
   * 由 hasSelection 告诉界面这是不是真的选过了。
   */
  readonly sliderValue: Rank;
  readonly hasSelection: boolean;
  readonly options: readonly SliderOptionView[];
  /** 只在反馈阶段出现。 */
  readonly feedback: NoteFeedbackView | null;
}

export interface ExerciseView {
  readonly id: string;
  readonly exerciseNumber: number;
  readonly noteCount: number;
  readonly notes: readonly NoteView[];
  /** 真实音高的音名，只在反馈阶段出现。 */
  readonly truthNoteNames: readonly NoteName[] | null;
  /** 整题跨度（半音数），只在反馈阶段出现。 */
  readonly truthSpanSemitones: number | null;
}

export interface SummaryItemView {
  readonly exerciseNumber: number;
  readonly noteNames: readonly NoteName[];
  readonly answeredRanks: readonly Rank[];
  readonly correctRanks: readonly Rank[];
  readonly isCorrect: boolean;
  readonly matchedCount: number;
  readonly replayCount: number;
}

export interface SummaryView {
  readonly total: number;
  readonly correct: number;
  readonly accuracyPercent: number;
  readonly specLabel: string;
  readonly items: readonly SummaryItemView[];
}

export interface DrillViewState {
  readonly phase: DrillPhase;
  readonly spec: DrillSpec;
  readonly specLabel: string;
  readonly loadProgress: number;
  readonly loadError: string | null;
  readonly sessionId: string | null;
  readonly exerciseNumber: number;
  readonly exerciseTotal: number;
  readonly exercise: ExerciseView | null;
  readonly judgment: Judgment | null;
  readonly replaysUsed: number;
  readonly replayLimit: number;
  readonly isPlaying: boolean;
  readonly canSubmit: boolean;
  readonly answeredSoFar: number;
  readonly correctSoFar: number;
  readonly accuracySoFar: number;
  readonly summary: SummaryView | null;
}

export interface BuildViewInput {
  readonly phase: DrillPhase;
  readonly spec: DrillSpec;
  readonly loadProgress: number;
  readonly loadError: string | null;
  readonly session: DrillSession | null;
  readonly exercise: Exercise | null;
  readonly exerciseNumber: number;
  readonly draft: readonly (Rank | null)[];
  readonly proposal: readonly (Rank | null)[];
  readonly judgment: Judgment | null;
  readonly replaysUsed: number;
  readonly isPlaying: boolean;
  readonly canSubmit: boolean;
}

function buildNoteViews(
  exercise: Exercise,
  draft: readonly (Rank | null)[],
  proposal: readonly (Rank | null)[],
  judgment: Judgment | null,
): NoteView[] {
  const noteCount = exercise.pitches.length;
  return exercise.pitches.map((pitchValue, noteIndex) => {
    const selectedRank = draft[noteIndex] ?? null;
    const proposedRank = proposal[noteIndex] ?? null;

    const options: SliderOptionView[] = Array.from({ length: noteCount }, (_, index) => {
      const rank = index + 1;
      const takenByIndex = draft.findIndex((value, at) => at !== noteIndex && value === rank);
      return {
        rank,
        label: `第 ${rank} 位`,
        isSelected: selectedRank === rank,
        isProposed: selectedRank !== rank && proposedRank === rank,
        isTakenByOther: takenByIndex >= 0,
      };
    });

    let feedback: NoteFeedbackView | null = null;
    if (judgment !== null) {
      const detail = judgment.details[noteIndex];
      const previousPitch = noteIndex > 0 ? (exercise.pitches[noteIndex - 1] as number) : null;
      feedback = {
        noteIndex,
        answeredRank: selectedRank,
        correctRank: detail?.correctRank ?? 0,
        isCorrect: detail?.isCorrect ?? false,
        noteName: pitchToNoteName(pitchValue),
        intervalFromPrevious:
          previousPitch === null ? null : intervalBetween(previousPitch, pitchValue),
      };
    }

    return {
      noteIndex,
      selectedRank,
      sliderValue: selectedRank ?? proposedRank ?? 1,
      hasSelection: selectedRank !== null,
      options,
      feedback,
    };
  });
}

function buildSummary(session: DrillSession): SummaryView {
  const items: SummaryItemView[] = summarize(session).map((item, index) => ({
    exerciseNumber: index + 1,
    noteNames: item.exercise.pitches.map(pitchToNoteName),
    answeredRanks: item.answer.ranks.map((rank) => rank ?? 0),
    correctRanks: [...correctRanks(item.exercise)],
    isCorrect: item.judgment.isCorrect,
    matchedCount: item.judgment.matchedCount,
    replayCount: item.replayCount,
  }));

  return {
    total: session.exercises.length,
    correct: correctCount(session),
    accuracyPercent: Math.round(accuracy(session) * 100),
    specLabel: describeDrillSpec(session.spec),
    items,
  };
}

export function buildDrillViewState(input: BuildViewInput): DrillViewState {
  const { session, exercise } = input;
  const answeredSoFar = session === null ? 0 : answeredCount(session);
  const correctSoFar = session === null ? 0 : correctCount(session);

  const exerciseView: ExerciseView | null =
    exercise === null
      ? null
      : {
          id: exercise.id,
          exerciseNumber: input.exerciseNumber,
          noteCount: exercise.pitches.length,
          notes: buildNoteViews(exercise, input.draft, input.proposal, input.judgment),
          truthNoteNames:
            input.judgment === null ? null : exercise.pitches.map(pitchToNoteName),
          truthSpanSemitones: input.judgment === null ? null : spanOf(exercise.pitches),
        };

  return {
    phase: input.phase,
    spec: input.spec,
    specLabel: describeDrillSpec(input.spec),
    loadProgress: input.loadProgress,
    loadError: input.loadError,
    sessionId: session?.id ?? null,
    exerciseNumber: input.exerciseNumber,
    exerciseTotal: session?.exercises.length ?? input.spec.exerciseCount,
    exercise: exerciseView,
    judgment: input.judgment,
    replaysUsed: input.replaysUsed,
    replayLimit: input.spec.replayLimit,
    isPlaying: input.isPlaying,
    canSubmit: input.canSubmit,
    answeredSoFar,
    correctSoFar,
    accuracySoFar: answeredSoFar === 0 ? 0 : correctSoFar / answeredSoFar,
    summary:
      session !== null && input.phase === 'finished' ? buildSummary(session) : null,
  };
}
