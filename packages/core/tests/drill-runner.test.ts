import { describe, expect, it } from 'vitest';
import {
  createDrillSpec,
  createDrillSession,
  createExerciseGenerator,
  DrillRunner,
  correctRanks,
  setRankAt,
  createAnswerDraft,
  summarize,
  accuracy,
  isComplete,
  formatRank,
  type AudioPlayer,
  type DrillRecord,
  type DrillRunnerEvent,
  type DrillSpec,
  type DrillViewState,
  type RandomSource,
  type Rank,
  type Semitones,
} from '../src/index';

const LCG_MOD = 2147483647;
function lcg(seed: number): RandomSource {
  let state = seed;
  return {
    next() {
      state = (state * 48271) % LCG_MOD;
      return state / LCG_MOD;
    },
  };
}

class FakeAudioPlayer implements AudioPlayer {
  ready = false;
  loaded = 0;
  played: (readonly Semitones[])[] = [];
  stopped = 0;
  /** 每次播放的持续时间（毫秒），用来模拟「上一题的回放还没播完」。 */
  playDurationMs = 0;

  isReady(): boolean {
    return this.ready;
  }

  async load(onProgress?: (ratio: number) => void): Promise<void> {
    this.loaded += 1;
    onProgress?.(0.5);
    onProgress?.(1);
    this.ready = true;
  }

  async playSequence(pitches: readonly Semitones[]): Promise<void> {
    this.played.push([...pitches]);
    if (this.playDurationMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.playDurationMs));
    }
  }

  async stop(): Promise<void> {
    this.stopped += 1;
  }
}

interface Harness {
  runner: DrillRunner;
  audio: FakeAudioPlayer;
  records: DrillRecord[];
  states: DrillViewState[];
  errors: string[];
  current: () => DrillViewState;
}

function createHarness(specOverrides: Partial<DrillSpec> & Pick<DrillSpec, 'noteCount' | 'spanPattern'>): Harness {
  const spec = createDrillSpec(specOverrides);
  const audio = new FakeAudioPlayer();
  const records: DrillRecord[] = [];
  const states: DrillViewState[] = [];
  const errors: string[] = [];

  const runner = new DrillRunner(spec, {
    audioPlayer: audio,
    audioTiming: { noteDurationMs: 10, noteGapMs: 1 },
    recordRepository: {
      async save(record: DrillRecord) {
        records.push(record);
      },
    },
    random: lcg(20260927),
    now: () => new Date('2026-09-27T10:00:00.000Z'),
  });

  runner.subscribe((event: DrillRunnerEvent) => {
    states.push(event.state);
    if (event.type === 'error' && event.message !== undefined) {
      errors.push(event.message);
    }
  });

  return { runner, audio, records, states, errors, current: () => runner.getState() };
}

/**
 * 用与 harness 相同的确定性随机源复现同一局的题目，
 * 从而在「反馈出现之前」就知道每道题的真实名次——用来测试「答对」这条路径。
 */
function reproduceTruth(
  specOverrides: Partial<DrillSpec> & Pick<DrillSpec, 'noteCount' | 'spanPattern'>,
  exerciseIndex: number,
): readonly Rank[] {
  const spec = createDrillSpec(specOverrides);
  const generator = createExerciseGenerator(lcg(20260927));
  const exercise = generator.generate(spec, `drill-1758967200000-ex${exerciseIndex + 1}`);
  return correctRanks(exercise);
}

describe('DrillRunner 一局流程', () => {
  it('开始 → 加载音频 → 自动播放第一题 → 状态进入 answering', async () => {
    const harness = createHarness({ noteCount: 3, spanPattern: 'within-octave', exerciseCount: 3 });
    await harness.runner.start();

    const state = harness.current();
    expect(harness.audio.loaded).toBe(1);
    expect(state.phase).toBe('answering');
    expect(state.exerciseNumber).toBe(1);
    expect(state.exerciseTotal).toBe(3);
    expect(state.exercise?.noteCount).toBe(3);
    expect(state.exercise?.notes).toHaveLength(3);
    // 每个滑块有 3 个档位可选
    expect(state.exercise?.notes[0]?.options).toHaveLength(3);
    expect(harness.audio.played).toHaveLength(1);
    expect(harness.audio.played[0]).toHaveLength(3);
  });

  it('加载失败时不进入答题，且暴露错误信息', async () => {
    const spec = createDrillSpec({ noteCount: 2, spanPattern: 'unrestricted' });
    const failing: AudioPlayer = {
      isReady: () => false,
      load: async () => {
        throw new Error('音色文件 404');
      },
      playSequence: async () => {},
      stop: async () => {},
    };
    const runner = new DrillRunner(spec, {
      audioPlayer: failing,
      audioTiming: { noteDurationMs: 1, noteGapMs: 0 },
    });
    await runner.start();
    const state = runner.getState();
    expect(state.phase).toBe('idle');
    expect(state.loadError).toBe('音色文件 404');
  });

  it('重听次数用完后拒绝再听，并给出提示', async () => {
    const harness = createHarness({
      noteCount: 2,
      spanPattern: 'unrestricted',
      replayLimit: 2,
    });
    await harness.runner.start();
    expect(harness.current().isPlaying).toBe(false);

    await harness.runner.play();
    expect(harness.current().replaysUsed).toBe(1);
    await harness.runner.play();
    expect(harness.current().replaysUsed).toBe(2);

    await harness.runner.play();
    expect(harness.current().replaysUsed).toBe(2);
    expect(harness.errors.at(-1)).toContain('重听次数');
  });

  it('提交后进入 revealed、给出对错、并重播一遍真实音频', async () => {
    const harness = createHarness({ noteCount: 3, spanPattern: 'unrestricted', exerciseCount: 2 });
    await harness.runner.start();
    const before = harness.audio.played.length;

    // 先故意填一个错的：全部填第 1 位无法提交（重复），改成错排
    harness.runner.selectRank(0, 3);
    harness.runner.selectRank(1, 1);
    harness.runner.selectRank(2, 2);
    expect(harness.current().canSubmit).toBe(true);

    await harness.runner.submit();
    const state = harness.current();
    expect(state.phase).toBe('revealed');
    expect(state.judgment).not.toBeNull();
    // 反馈里才有音名与真实跨度
    expect(state.exercise?.truthNoteNames).toHaveLength(3);
    expect(state.exercise?.truthSpanSemitones).toBeGreaterThan(0);
    // 提交后自动重播一遍真实音频
    expect(harness.audio.played.length).toBe(before + 1);
    expect(state.exercise?.notes[0]?.feedback).not.toBeNull();
  });

  it('未填满或重复时不能提交，并且不会产生判分', async () => {
    const harness = createHarness({ noteCount: 3, spanPattern: 'unrestricted' });
    await harness.runner.start();

    harness.runner.selectRank(0, 1);
    expect(harness.current().canSubmit).toBe(false);
    await harness.runner.submit();
    expect(harness.current().judgment).toBeNull();
    expect(harness.errors.at(-1)).toContain('不同的档位');

    // 两个滑块不能落在同一档位：后来者抢走已被占用的档位，原占用者变成未作答
    harness.runner.selectRank(1, 1);
    const ranks = harness.current().exercise?.notes.map((note) => note.selectedRank);
    expect(ranks).toEqual([null, 1, null]);
  });

  it('走完一局会进入 finished、给出总结并存档', async () => {
    const harness = createHarness({
      noteCount: 2,
      spanPattern: 'within-octave',
      exerciseCount: 3,
    });
    await harness.runner.start();

    for (let index = 0; index < 3; index += 1) {
      const state = harness.current();
      // 「正在看的那一题」和显示的题号必须一致——这是界面上唯一能让用户对上号的东西
      expect(state.exerciseNumber).toBe(index + 1);
      expect(state.exercise?.id).toContain(`ex${index + 1}`);
      // 用「反着填」制造错误：第一个音填第 2 位、第二个填第 1 位
      harness.runner.selectRank(0, 2);
      harness.runner.selectRank(1, 1);
      await harness.runner.submit();
      const revealed = harness.current();
      expect(revealed.phase).toBe('revealed');
      // 反馈期必须仍然拿着刚答完的那道题（最后一题也不能丢），且题号不跳
      expect(revealed.exercise?.id).toContain(`ex${index + 1}`);
      expect(revealed.exerciseNumber).toBe(index + 1);
      expect(revealed.judgment).not.toBeNull();
      await harness.runner.next();
    }

    const final = harness.current();
    expect(final.phase).toBe('finished');
    expect(final.summary).not.toBeNull();
    expect(final.summary?.total).toBe(3);
    expect(final.summary?.items).toHaveLength(3);
    expect(harness.records).toHaveLength(1);
    expect(harness.records[0]?.totalCount).toBe(3);
    expect(harness.records[0]?.results).toHaveLength(3);
  });

  it('用正确排序作答时判为正确，并记入统计', async () => {
    const overrides = { noteCount: 3, spanPattern: 'within-octave' as const, exerciseCount: 2 };
    const harness = createHarness(overrides);
    await harness.runner.start();

    const truth = reproduceTruth(overrides, 0);
    truth.forEach((rank, noteIndex) => {
      harness.runner.selectRank(noteIndex, rank);
    });
    expect(harness.current().canSubmit).toBe(true);

    await harness.runner.submit();
    const state = harness.current();
    expect(state.judgment?.isCorrect).toBe(true);
    expect(state.judgment?.matchedCount).toBe(3);
    expect(state.correctSoFar).toBe(1);
    expect(state.accuracySoFar).toBe(1);
    expect(state.exercise?.notes.every((note) => note.feedback?.isCorrect === true)).toBe(true);
  });

  it('未确认的落点不算已选，提交按钮不会被误认为可以按', async () => {
    const harness = createHarness({ noteCount: 3, spanPattern: 'unrestricted' });
    await harness.runner.start();

    // 模拟用户按住滑块停在第 3 档但还没松开（只有 proposal，没有 commit）
    harness.runner.proposeRank(0, 3);
    const proposed = harness.current();
    expect(proposed.exercise?.notes[0]?.selectedRank).toBeNull();
    expect(proposed.exercise?.notes[0]?.hasSelection).toBe(false);
    // 滑块位置跟着走，但领域状态仍是未选择
    expect(proposed.exercise?.notes[0]?.sliderValue).toBe(3);
    expect(proposed.exercise?.notes[0]?.options[2]?.isProposed).toBe(true);
    expect(proposed.exercise?.notes[0]?.options[2]?.isSelected).toBe(false);
    expect(proposed.canSubmit).toBe(false);

    // 确认之后才算已选
    harness.runner.selectRank(0, 3);
    const committed = harness.current();
    expect(committed.exercise?.notes[0]?.selectedRank).toBe(3);
    expect(committed.exercise?.notes[0]?.hasSelection).toBe(true);
    expect(committed.exercise?.notes[0]?.options[2]?.isSelected).toBe(true);
    expect(committed.exercise?.notes[0]?.options[2]?.isProposed).toBe(false);
  });

  it('未作答的滑块有一个显示用的默认位置，不会被当成已选', async () => {
    const harness = createHarness({ noteCount: 4, spanPattern: 'unrestricted' });
    await harness.runner.start();
    const note = harness.current().exercise?.notes[0];
    expect(note?.selectedRank).toBeNull();
    expect(note?.hasSelection).toBe(false);
    expect(note?.sliderValue).toBe(1);
    expect(note?.options.some((option) => option.isSelected)).toBe(false);
    expect(harness.current().canSubmit).toBe(false);
  });

  it('越界的落点被忽略，不会把状态改坏', async () => {
    const harness = createHarness({ noteCount: 3, spanPattern: 'unrestricted' });
    await harness.runner.start();
    harness.runner.proposeRank(0, 9);
    harness.runner.proposeRank(0, 0);
    expect(harness.current().exercise?.notes[0]?.sliderValue).toBe(1);
    expect(harness.current().exercise?.notes[0]?.hasSelection).toBe(false);
  });

  it('回放还没播完就重置，状态不会被那条迟到的收尾卡在「播放中」', async () => {
    const harness = createHarness({ noteCount: 2, spanPattern: 'unrestricted', exerciseCount: 3 });
    harness.audio.playDurationMs = 60;
    await harness.runner.start();
    await new Promise((resolve) => setTimeout(resolve, 90));
    expect(harness.current().isPlaying).toBe(false);

    // 用户点「再听一遍」后马上点「结束」：这次播放还挂在 await 上
    void harness.runner.play();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(harness.current().isPlaying).toBe(true);

    await harness.runner.reset();
    expect(harness.current().isPlaying).toBe(false);
    expect(harness.current().phase).toBe('idle');

    // 等那条迟到的收尾执行完——它不许把状态改回去
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(harness.current().isPlaying).toBe(false);
    expect(harness.current().phase).toBe('idle');
    expect(harness.current().sessionId).toBeNull();
  });

  it('依次给每个滑块选档位时，先选好的答案不会被后面的滑块清空', async () => {
    const harness = createHarness({ noteCount: 3, spanPattern: 'unrestricted' });
    await harness.runner.start();
    const ranks = () => harness.current().exercise?.notes.map((note) => note.selectedRank);

    // 用户按界面顺序依次点击：①第 1 位、②第 2 位、③第 3 位
    harness.runner.selectRank(0, 1);
    expect(ranks()).toEqual([1, null, null]);

    harness.runner.selectRank(1, 2);
    // 关键：第一个滑块必须还停在第 1 位
    expect(ranks()).toEqual([1, 2, null]);

    harness.runner.selectRank(2, 3);
    expect(ranks()).toEqual([1, 2, 3]);
    expect(harness.current().canSubmit).toBe(true);
  });

  it('抢一个已被占用的档位时，占用者接手当前滑块原来的档位（真正的互换）', async () => {
    const harness = createHarness({ noteCount: 3, spanPattern: 'unrestricted' });
    await harness.runner.start();
    const ranks = () => harness.current().exercise?.notes.map((note) => note.selectedRank);

    harness.runner.selectRank(0, 1);
    harness.runner.selectRank(1, 2);
    expect(ranks()).toEqual([1, 2, null]);

    // 第 3 个滑块（原本未作答）抢走第 2 位：第 2 个滑块变成未作答，且不出现重复档位
    harness.runner.selectRank(2, 2);
    expect(ranks()).toEqual([1, null, 2]);

    // 它已有档位后再抢第 1 位：与第 1 个滑块真正互换
    harness.runner.selectRank(2, 1);
    expect(ranks()).toEqual([2, null, 1]);
    expect(harness.current().canSubmit).toBe(false);
  });

  it('答完一局、再开一局又中途退出之后，仍然可以更换规格', async () => {
    const overrides = { noteCount: 3, spanPattern: 'unrestricted' as const, exerciseCount: 2 };
    const harness = createHarness(overrides);

    // 1. 完整走完一局
    await harness.runner.start();
    for (let q = 0; q < 2; q += 1) {
      harness.runner.selectRank(0, 1);
      harness.runner.selectRank(1, 2);
      harness.runner.selectRank(2, 3);
      await harness.runner.submit();
      await harness.runner.next();
    }
    expect(harness.current().phase).toBe('finished');

    // 2. 再练一局（同规格），然后中途结束——这正是界面「再练一局 → 结束 → 换规格」的路径
    await harness.runner.reset();
    await harness.runner.start();
    expect(harness.current().phase).toBe('answering');
    await harness.runner.reset();
    expect(harness.current().phase).toBe('idle');
    // reset 之后残留的旧 session 不能再暴露给界面
    expect(harness.current().sessionId).toBeNull();
    expect(harness.current().exercise).toBeNull();

    // 3. 换规格必须生效（曾经在这里抛「一局练习进行中，不能更换规格」，用户被静默打回旧规格）
    expect(() =>
      harness.runner.setSpec(createDrillSpec({ noteCount: 4, spanPattern: 'within-octave' })),
    ).not.toThrow();
    const swapped = harness.current().spec;
    expect(swapped.noteCount).toBe(4);
    expect(swapped.spanPattern).toBe('within-octave');

    // 4. 用新规格开始，出的题必须真的是新规格
    await harness.runner.start();
    const state = harness.current();
    expect(state.spec.noteCount).toBe(4);
    expect(state.exercise?.noteCount).toBe(4);
    expect(state.exercise?.notes).toHaveLength(4);
    for (const note of state.exercise?.notes ?? []) {
      expect(note.options).toHaveLength(4);
    }
  });

  it('一局正在进行时更换规格会被明确拒绝（而不是静默改坏状态）', async () => {
    const harness = createHarness({ noteCount: 2, spanPattern: 'unrestricted', exerciseCount: 3 });
    await harness.runner.start();
    expect(harness.current().phase).toBe('answering');
    expect(() => harness.runner.setSpec(createDrillSpec({ noteCount: 5, spanPattern: 'within-octave' }))).toThrow();
    // 拒绝之后，当前这一局必须原样继续
    expect(harness.current().spec.noteCount).toBe(2);
    expect(harness.current().exercise?.noteCount).toBe(2);
  });

  it('view state 里能拿到整局题库的真实音高（forge 快照），且不泄漏到界面显示上', async () => {
    const overrides = { noteCount: 4, spanPattern: 'within-octave' as const, exerciseCount: 5 };
    const harness = createHarness(overrides);
    await harness.runner.start();

    const state = harness.current();
    // 核查用快照：整局 5 题、每题 4 个音、音高与正确答案都拿得到
    expect(state.forge).toHaveLength(5);
    for (const item of state.forge) {
      expect(item.pitches).toHaveLength(4);
      expect(new Set(item.pitches).size).toBe(4);
      expect(item.noteNames).toHaveLength(4);
      expect([...item.correctRanks].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
      expect(Math.max(...item.pitches) - Math.min(...item.pitches)).toBeLessThanOrEqual(12);
    }

    // 但答题中界面侧依然不显示音高与真实跨度
    expect(state.exercise?.truthNoteNames).toBeNull();
    expect(state.exercise?.truthSpanSemitones).toBeNull();
    expect(state.exercise?.notes.every((note) => note.feedback === null)).toBe(true);

    // forge 与正确答案必须一致
    const truth = reproduceTruth(overrides, 0);
    expect([...state.forge[0]!.correctRanks]).toEqual([...truth]);
  });

  it('没有一局练习时 forge 是空的，不会把上一局的题库留在界面状态里', async () => {
    const harness = createHarness({ noteCount: 2, spanPattern: 'unrestricted', exerciseCount: 2 });
    expect(harness.current().forge).toEqual([]);
    await harness.runner.start();
    expect(harness.current().forge).toHaveLength(2);
    await harness.runner.reset();
    expect(harness.current().forge).toEqual([]);
  });

  it('结算后 reset 回到未开始状态', async () => {
    const harness = createHarness({ noteCount: 2, spanPattern: 'unrestricted', exerciseCount: 1 });
    await harness.runner.start();
    harness.runner.selectRank(0, 1);
    harness.runner.selectRank(1, 2);
    await harness.runner.submit();
    await harness.runner.next();
    expect(harness.current().phase).toBe('finished');

    await harness.runner.reset();
    const state = harness.current();
    expect(state.phase).toBe('idle');
    expect(state.sessionId).toBeNull();
    expect(state.summary).toBeNull();
    expect(harness.audio.stopped).toBeGreaterThan(0);
  });
});

describe('一局练习的统计', () => {
  it('正确率、逐题明细、完成判定', () => {
    const spec = createDrillSpec({ noteCount: 2, spanPattern: 'unrestricted', exerciseCount: 3 });
    const session = createDrillSession('drill-1', spec, [
      { id: 'ex1', pitches: [0, 7] },
      { id: 'ex2', pitches: [0, 5] },
      { id: 'ex3', pitches: [3, -2] },
    ]);

    expect(isComplete(session)).toBe(false);
    expect(accuracy(session)).toBe(0);
    expect(summarize(session)).toHaveLength(0);
  });

  it('档位文案', () => {
    expect(formatRank(1)).toBe('第 1 位');
    expect(formatRank(null)).toBe('未选');
  });

  it('草稿工具函数保持不可变', () => {
    const draft = createAnswerDraft(3);
    const next = setRankAt(draft, 1, 2);
    expect(draft).toEqual([null, null, null]);
    expect(next).toEqual([null, 2, null]);
  });
});
