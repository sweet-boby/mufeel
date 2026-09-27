/**
 * 一局练习的编排（应用层用例）。
 *
 * 它把「出题器 / 判分器 / 播放器 / 记录仓储」串成一条流程，并产出界面能直接渲染的
 * view state。规则一条都不在这里：出题规则在 domain/services/exercise-generator，
 * 判分规则在 domain/services/judge，这里只负责顺序、重听次数、状态切换和存档。
 */

import { createDrillSession, isComplete, recordAttempt, type DrillSession } from '../domain/entities/drill-session';
import type { DrillSpec } from '../domain/entities/drill-spec';
import type { AnswerDraft } from '../domain/entities/answer';
import {
  assignRank,
  createAnswerDraft,
  isDraftSubmittable,
  setRankAt,
  submitDraft,
} from '../domain/entities/answer';
import type { Exercise } from '../domain/entities/exercise';
import type { Judgment } from '../domain/entities/judgment';
import type { AudioPlayer } from '../domain/ports/audio-player';
import type { DrillRecord } from '../domain/ports/drill-record-repository';
import { createMathRandomSource, type RandomSource } from '../domain/ports/random-source';
import type { ExerciseGenerator } from '../domain/services/exercise-generator';
import { createExerciseGenerator } from '../domain/services/exercise-generator';
import type { Judge } from '../domain/services/judge';
import { createRankOrderJudge } from '../domain/services/judge';
import type { Rank } from '../domain/value-objects/rank';
import { createEmitter, type Emitter, type Unsubscribe } from './emitter';
import { buildDrillViewState, type DrillPhase, type DrillViewState } from './view-model';

export interface DrillRunnerDependencies {
  readonly audioPlayer: AudioPlayer;
  readonly audioTiming: { readonly noteDurationMs: number; readonly noteGapMs: number };
  readonly recordRepository?: {
    save(record: DrillRecord): Promise<void>;
  };
  readonly random?: RandomSource;
  readonly generator?: ExerciseGenerator;
  readonly judge?: Judge;
  readonly now?: () => Date;
}

export interface DrillRunnerEvent {
  readonly type: 'state' | 'error';
  readonly state: DrillViewState;
  readonly message?: string;
}

interface InternalState {
  phase: DrillPhase;
  spec: DrillSpec;
  loadProgress: number;
  loadError: string | null;
  session: DrillSession | null;
  /**
   * 当前正在处理的题目（正在作答或正在看反馈的那一道）。
   *
   * 必须显式记录，不能用「第几道还没答」去推导：答完最后一题后 attempts.length
   * 等于题数，推导出来就是 undefined，界面会以为没有题目了——最后一题的反馈
   * 和整局的结算都会消失。
   */
  activeExercise: Exercise | null;
  draft: AnswerDraft;
  /** 用户当前停在哪一档（还没确认），用于让界面把滑块位置和「已选」区分开。 */
  proposal: readonly (Rank | null)[];
  judgment: Judgment | null;
  replaysUsed: number;
  isPlaying: boolean;
}

export class DrillRunner {
  readonly #audio: AudioPlayer;
  readonly #timing: { readonly noteDurationMs: number; readonly noteGapMs: number };
  readonly #records: DrillRunnerDependencies['recordRepository'];
  readonly #random: RandomSource;
  readonly #generator: ExerciseGenerator;
  readonly #judge: Judge;
  readonly #now: () => Date;
  readonly #emitter: Emitter<DrillRunnerEvent> = createEmitter<DrillRunnerEvent>();
  #state: InternalState;
  #playToken = 0;

  constructor(spec: DrillSpec, dependencies: DrillRunnerDependencies) {
    this.#audio = dependencies.audioPlayer;
    this.#timing = dependencies.audioTiming;
    this.#records = dependencies.recordRepository;
    this.#random = dependencies.random ?? createMathRandomSource();
    this.#generator = dependencies.generator ?? createExerciseGenerator(this.#random);
    this.#judge = dependencies.judge ?? createRankOrderJudge();
    this.#now = dependencies.now ?? (() => new Date());
    this.#state = {
      phase: 'idle',
      spec,
      loadProgress: 0,
      loadError: null,
      session: null,
      activeExercise: null,
      draft: createAnswerDraft(spec.noteCount),
      proposal: createAnswerDraft(spec.noteCount),
      judgment: null,
      replaysUsed: 0,
      isPlaying: false,
    };
  }

  getState(): DrillViewState {
    return this.#buildState();
  }

  subscribe(listener: (event: DrillRunnerEvent) => void): Unsubscribe {
    const unsubscribe = this.#emitter.subscribe(listener);
    listener({ type: 'state', state: this.#buildState() });
    return unsubscribe;
  }

  /**
   * 换练习规格（首页改了音数或难度）。
   *
   * 判据必须是「阶段」而不是「有没有 session 对象」：一局答完之后、或者点了
   * 「再练一局」又结束之后，状态里可能还留着上一局的 session，
   * 用它来判断「练习进行中」会误伤——用户换了规格点开始，却被打回旧规格。
   */
  setSpec(spec: DrillSpec): void {
    if (this.#isDrillInProgress()) {
      throw new Error('一局练习进行中，不能更换规格');
    }
    this.#state = {
      ...this.#state,
      spec,
      phase: 'idle',
      session: null,
      activeExercise: null,
      draft: createAnswerDraft(spec.noteCount),
      proposal: createAnswerDraft(spec.noteCount),
      judgment: null,
      replaysUsed: 0,
      isPlaying: false,
    };
    this.#emit();
  }

  #isDrillInProgress(): boolean {
    return (
      this.#state.phase === 'listening' ||
      this.#state.phase === 'answering' ||
      this.#state.phase === 'revealed'
    );
  }

  /** 现在的重听上限：一局里每道题都是这个数。 */
  setReplayLimit(limit: number): void {
    this.#state = { ...this.#state, spec: { ...this.#state.spec, replayLimit: limit } };
    this.#emit();
  }

  /** 开始一局：加载采样 → 一次性出好所有题 → 自动播放第一题。 */
  async start(): Promise<void> {
    this.#state = { ...this.#state, phase: 'loading-audio', loadProgress: 0, loadError: null };
    this.#emit();

    try {
      await this.#audio.load((ratio) => {
        this.#state = { ...this.#state, loadProgress: ratio };
        this.#emit();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '钢琴音色加载失败';
      this.#state = { ...this.#state, phase: 'idle', loadError: message };
      this.#emit();
      return;
    }

    const sessionId = `drill-${this.#now().getTime()}`;
    const exercises: Exercise[] = Array.from({ length: this.#state.spec.exerciseCount }, (_, index) =>
      this.#generator.generate(this.#state.spec, `${sessionId}-ex${index + 1}`),
    );

    this.#state = {
      ...this.#state,
      phase: 'listening',
      loadError: null,
      session: createDrillSession(sessionId, this.#state.spec, exercises),
      activeExercise: exercises[0] ?? null,
      draft: createAnswerDraft(this.#state.spec.noteCount),
      proposal: createAnswerDraft(this.#state.spec.noteCount),
      judgment: null,
      replaysUsed: 0,
      isPlaying: false,
    };

    await this.#playCurrent();
  }

  /** 播放当前题目。首次播放不计入重听次数，之后每次都要消耗一次。 */
  async play(): Promise<void> {
    const exercise = this.#currentExercise();
    if (exercise === null || this.#state.isPlaying) {
      return;
    }
    if (this.#state.replaysUsed >= this.#state.spec.replayLimit) {
      this.#emitError('这道题的重听次数已经用完了');
      return;
    }
    this.#state = { ...this.#state, replaysUsed: this.#state.replaysUsed + 1 };
    await this.#playCurrent();
  }

  /**
   * 记录用户当前停在哪一档，但不算「已选」。
   * 界面上用滑块位置表达，用于把「拖把停在这里」和「确认选它」区分开。
   */
  proposeRank(noteIndex: number, rank: Rank): void {
    if (this.#state.phase !== 'answering' && this.#state.phase !== 'listening') {
      return;
    }
    if (!Number.isInteger(rank) || rank < 1 || rank > this.#state.spec.noteCount) {
      return;
    }
    this.#state = {
      ...this.#state,
      proposal: setRankAt(this.#state.proposal, noteIndex, rank),
    };
    this.#emit();
  }

  /**
   * 确认选中某个档位。目标档位已被别的滑块占用时的处理规则写在领域里
   * （domain/entities/answer.ts 的 assignRank）——这里只负责调用与广播。
   */
  selectRank(noteIndex: number, rank: Rank): void {
    if (this.#state.phase !== 'answering' && this.#state.phase !== 'listening') {
      return;
    }
    this.#state = {
      ...this.#state,
      draft: assignRank(this.#state.draft, noteIndex, rank),
      proposal: setRankAt(this.#state.proposal, noteIndex, rank),
      phase: 'answering',
    };
    this.#emit();
  }

  /** 提交作答：判分 → 重播一次正确答案 → 等用户点「下一题」。 */
  async submit(): Promise<void> {
    const session = this.#state.session;
    const exercise = this.#currentExercise();
    if (session === null || exercise === null || this.#state.judgment !== null) {
      return;
    }
    if (!isDraftSubmittable(this.#state.draft, exercise.pitches.length)) {
      this.#emitError('请先把每个滑块都放在不同的档位上');
      return;
    }

    const answer = submitDraft(exercise, this.#state.draft);
    const judgment = this.#judge.judge(exercise, answer);

    this.#state = {
      ...this.#state,
      session: recordAttempt(session, {
        answer,
        judgment,
        replayCount: this.#state.replaysUsed,
      }),
      judgment,
      phase: 'revealed',
    };
    this.#emit();

    await this.#playPitches(exercise.pitches);
  }

  /** 进入下一题；已是最后一题则结算并存档。 */
  async next(): Promise<void> {
    const session = this.#state.session;
    if (session === null || this.#state.judgment === null) {
      return;
    }

    if (isComplete(session)) {
      await this.#finish(session);
      return;
    }

    // 先取消上一题的回放（它可能还没播完），再切题；否则迟到的收尾会污染新题目状态。
    this.#playToken += 1;
    await this.#audio.stop();

    const answeredCount = session.attempts.length;
    this.#state = {
      ...this.#state,
      activeExercise: session.exercises[answeredCount] ?? null,
      draft: createAnswerDraft(this.#state.spec.noteCount),
      proposal: createAnswerDraft(this.#state.spec.noteCount),
      judgment: null,
      replaysUsed: 0,
      isPlaying: false,
      phase: 'listening',
    };
    this.#emit();
    await this.#playCurrent();
  }

  /** 回到未开始状态（用于「换规格」）。 */
  async reset(): Promise<void> {
    this.#playToken += 1;
    await this.#audio.stop();
    this.#state = {
      phase: 'idle',
      spec: this.#state.spec,
      loadProgress: this.#audio.isReady() ? 1 : 0,
      loadError: null,
      session: null,
      activeExercise: null,
      draft: createAnswerDraft(this.#state.spec.noteCount),
      proposal: createAnswerDraft(this.#state.spec.noteCount),
      judgment: null,
      replaysUsed: 0,
      isPlaying: false,
    };
    this.#emit();
  }

  async destroy(): Promise<void> {
    this.#playToken += 1;
    await this.#audio.stop();
    this.#state = { ...this.#state, isPlaying: false };
  }

  async #finish(session: DrillSession): Promise<void> {
    this.#state = { ...this.#state, phase: 'finished', isPlaying: false };
    this.#emit();

    if (this.#records !== undefined) {
      try {
        await this.#records.save({
          id: session.id,
          finishedAt: this.#now().toISOString(),
          spec: session.spec,
          correctCount: session.attempts.filter((attempt) => attempt.judgment.isCorrect).length,
          totalCount: session.exercises.length,
          results: session.attempts.map((attempt) => attempt.judgment.isCorrect),
        });
      } catch {
        // 存档失败不该影响用户看结果。
      }
    }
  }

  /** 当前正在作答或正在看反馈的那道题；由状态显式持有，不做推导。 */
  #currentExercise(): Exercise | null {
    return this.#state.session === null ? null : this.#state.activeExercise;
  }

  async #playCurrent(): Promise<void> {
    const exercise = this.#currentExercise();
    if (exercise === null) {
      return;
    }
    if (this.#state.phase === 'listening') {
      this.#state = { ...this.#state, phase: 'answering' };
    }
    await this.#playPitches(exercise.pitches);
  }

  async #playPitches(pitches: readonly number[]): Promise<void> {
    const token = (this.#playToken += 1);
    this.#state = { ...this.#state, isPlaying: true };
    this.#emit();
    try {
      await this.#audio.playSequence(pitches, this.#timing);
    } finally {
      // 只有「仍然是最新的那次播放」才允许改状态。
      // 取消播放的一方（reset / 换题 / destroy）会先把 token 推进并自己复位 isPlaying，
      // 所以这里过期的收尾必须什么都不做，否则它会把新题目的播放状态覆盖掉，
      // 界面就会卡在「播放中」——滑块全禁用，看起来像程序坏了。
      if (token === this.#playToken) {
        this.#state = { ...this.#state, isPlaying: false };
        this.#emit();
      }
    }
  }

  #buildState(): DrillViewState {
    // 只有真正在一局里（或刚结算）才把 session 暴露给界面；
    // reset / setSpec 之后即使状态里还残留旧的 session，也不该再出现在 view state 里。
    const session =
      this.#state.phase === 'idle' || this.#state.phase === 'loading-audio'
        ? null
        : this.#state.session;
    const exercise = this.#currentExercise();
    const noteCount = exercise?.pitches.length ?? this.#state.spec.noteCount;
    return buildDrillViewState({
      phase: this.#state.phase,
      spec: this.#state.spec,
      loadProgress: this.#state.loadProgress,
      loadError: this.#state.loadError,
      session,
      exercise,
      exerciseNumber: this.#currentExerciseNumber(session),
      draft: this.#state.draft,
      proposal: this.#state.proposal,
      judgment: this.#state.judgment,
      replaysUsed: this.#state.replaysUsed,
      isPlaying: this.#state.isPlaying,
      canSubmit: isDraftSubmittable(this.#state.draft, noteCount),
    });
  }

  /**
   * 当前是第几题（1-based）。
   * 直接由「正在看的那道题」在题目序列里的位置决定，不另做推导——
   * 推导出来的题号一旦和实际显示的题目不一致，用户就会看到「第 2 题」配着第 1 题的音频。
   */
  #currentExerciseNumber(session: DrillSession | null): number {
    if (session === null || this.#state.activeExercise === null) {
      return 1;
    }
    const index = session.exercises.findIndex(
      (exercise) => exercise.id === this.#state.activeExercise?.id,
    );
    return index < 0 ? 1 : index + 1;
  }
  #emit(): void {
    this.#emitter.emit({ type: 'state', state: this.#buildState() });
  }

  #emitError(message: string): void {
    this.#emitter.emit({ type: 'error', state: this.#buildState(), message });
  }
}
