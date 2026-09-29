import { describe, expect, it } from 'vitest';
import {
  assignSample,
  assignRank,
  createDrillSpec,
  createDrillSpecForTier,
  createExerciseGenerator,
  createRankOrderJudge,
  DEFAULT_EXERCISE_COUNT,
  DEFAULT_RANGE,
  DEFAULT_REPLAY_LIMIT,
  describeDrillSpec,
  DIFFICULTY_TIERS,
  DIFFICULTY_TIER_ORDER,
  MAX_NOTE_COUNT,
  maxSpanOf,
  MIN_NOTE_COUNT,
  OCTAVE_SEMITONES,
  WIDE_RANGE,
  submitDraft,
  createAnswerDraft,
  setRankAt,
  isDraftSubmittable,
  ranksTakenByOthers,
  correctRanks,
  positionsOf,
  spanOf,
  noteNameToPitch,
  pitchToNoteName,
  isCompleteAssignment,
  type DrillSpec,
  type RandomSource,
  type Semitones,
} from '../src/index';

/** 确定性随机源：按固定序列吐数，用来复现同一局题目。 */
function fixedRandom(values: readonly number[]): RandomSource {
  let cursor = 0;
  return {
    next() {
      const value = values[cursor % values.length] as number;
      cursor += 1;
      return value;
    },
  };
}

const LCG_MOD = 2147483647;
/** 线性同余伪随机，用于统计性质检查（可复现，不依赖 Math.random）。 */
function lcg(seed: number): RandomSource {
  let state = seed;
  return {
    next() {
      state = (state * 48271) % LCG_MOD;
      return state / LCG_MOD;
    },
  };
}

describe('出题器', () => {
  const withinOctave: DrillSpec = createDrillSpec({ noteCount: 3, spanPattern: 'within-octave' });
  const unrestricted: DrillSpec = createDrillSpec({ noteCount: 3, spanPattern: 'unrestricted' });

  it('固定随机源下可复现同一道题', () => {
    const random = [0.1, 0.5, 0.9, 0.3, 0.7, 0.2];
    const a = createExerciseGenerator(fixedRandom(random)).generate(withinOctave, 'ex1');
    const b = createExerciseGenerator(fixedRandom(random)).generate(withinOctave, 'ex1');
    expect(a).toEqual(b);
  });

  it('200 局 × 每局 10 题：音数、互不相同、八度内跨度、音域都满足', () => {
    const generator = createExerciseGenerator(lcg(20260927));

    for (const noteCount of [2, 3, 4, 5]) {
      for (const spanPattern of ['within-octave', 'unrestricted'] as const) {
        const spec = createDrillSpec({ noteCount, spanPattern });
        for (let round = 0; round < 200; round += 1) {
          for (let index = 0; index < 10; index += 1) {
            const exercise = generator.generate(spec, `ex${round}-${index}`);

            // 1. 音数正确
            expect(exercise.pitches).toHaveLength(noteCount);
            // 2. 音都在音域内
            for (const pitch of exercise.pitches) {
              expect(pitch).toBeGreaterThanOrEqual(spec.range.min);
              expect(pitch).toBeLessThanOrEqual(spec.range.max);
            }
            // 3. 互不相同
            expect(new Set(exercise.pitches).size).toBe(noteCount);
            // 4. 跨度满足难度档
            const span = spanOf(exercise.pitches);
            if (spanPattern === 'within-octave') {
              expect(span).toBeLessThanOrEqual(12);
            } else {
              expect(span).toBeLessThanOrEqual(spec.range.max - spec.range.min);
            }
            // 5. 正确答案是 1…n 的一个排列
            expect(isCompleteAssignment(correctRanks(exercise), noteCount)).toBe(true);
            expect([...correctRanks(exercise)].sort((x, y) => x - y)).toEqual(
              Array.from({ length: noteCount }, (_, i) => i + 1),
            );
          }
        }
      }
    }
  });

  it('播放顺序会被打乱，不是永远升序', () => {
    const generator = createExerciseGenerator(lcg(7));
    let nonAscending = 0;
    for (let index = 0; index < 200; index += 1) {
      const exercise = generator.generate(unrestricted, `ex${index}`);
      const ranks = correctRanks(exercise);
      if (ranks.some((rank, at) => rank !== at + 1)) {
        nonAscending += 1;
      }
    }
    expect(nonAscending).toBeGreaterThan(150);
  });

  it('音高会变化，不会每次都弹同一组音', () => {
    const generator = createExerciseGenerator(lcg(99));
    const seen = new Set<string>();
    for (let index = 0; index < 200; index += 1) {
      const exercise = generator.generate(withinOctave, `ex${index}`);
      seen.add([...exercise.pitches].sort((a, b) => a - b).join(','));
    }
    expect(seen.size).toBeGreaterThan(50);
  });
});

describe('难度档到规格的映射', () => {
  it('每一档的音域与跨度规则', () => {
    const standard = createDrillSpecForTier('standard', 3);
    expect(standard.range).toEqual(DEFAULT_RANGE);
    expect(standard.spanPattern).toBe('unrestricted');

    const octave = createDrillSpecForTier('octave', 3);
    expect(octave.range).toEqual(DEFAULT_RANGE);
    expect(octave.spanPattern).toBe('within-octave');

    const wide = createDrillSpecForTier('wide', 3);
    expect(wide.range).toEqual(WIDE_RANGE);
    expect(wide.spanPattern).toBe('unrestricted');
    // 宽音域就是采样覆盖的完整范围（C1–A7）
    expect(wide.range.min).toBe(-36);
    expect(wide.range.max).toBe(45);

    // 三档的音数与出题次数等默认值一致
    for (const spec of [standard, octave, wide]) {
      expect(spec.noteCount).toBe(3);
      expect(spec.exerciseCount).toBe(DEFAULT_EXERCISE_COUNT);
      expect(spec.replayLimit).toBe(DEFAULT_REPLAY_LIMIT);
    }
  });

  it('宽音域档里的每个音高都能用采样精确发声（变调 ≤ 1 个半音）', () => {
    // 这一档的音域等于采样覆盖范围，所以整档内都不会被夹回、也不需要大跨度变调
    for (let pitch = WIDE_RANGE.min; pitch <= WIDE_RANGE.max; pitch += 1) {
      expect(Math.abs(assignSample(pitch).detuneSemitones)).toBeLessThanOrEqual(1);
    }
  });

  it('每一档 × 每种音数都能出题，且题目满足该档的音域与跨度', () => {
    const generator = createExerciseGenerator(lcg(31337));
    for (const tier of DIFFICULTY_TIER_ORDER) {
      for (let noteCount = MIN_NOTE_COUNT; noteCount <= MAX_NOTE_COUNT; noteCount += 1) {
        const spec = createDrillSpecForTier(tier, noteCount);
        for (let index = 0; index < 50; index += 1) {
          const exercise = generator.generate(spec, `${tier}-${noteCount}-${index}`);
          expect(exercise.pitches).toHaveLength(noteCount);
          expect(new Set(exercise.pitches).size).toBe(noteCount);
          for (const pitch of exercise.pitches) {
            expect(pitch).toBeGreaterThanOrEqual(spec.range.min);
            expect(pitch).toBeLessThanOrEqual(spec.range.max);
          }
          expect(spanOf(exercise.pitches)).toBeLessThanOrEqual(maxSpanOf(spec));
          if (spec.spanPattern === 'within-octave') {
            expect(spanOf(exercise.pitches)).toBeLessThanOrEqual(OCTAVE_SEMITONES);
          }
        }
      }
    }
  });

  it('规格文案由难度档自己的名字产出：按钮叫什么，练习页与结算页就写什么', () => {
    const labels = DIFFICULTY_TIER_ORDER.map((tier) =>
      describeDrillSpec(createDrillSpecForTier(tier, 3)),
    );
    // 两两不同：否则历史记录里两局无法区分
    expect(new Set(labels).size).toBe(DIFFICULTY_TIER_ORDER.length);
    DIFFICULTY_TIER_ORDER.forEach((tier, index) => {
      // 界面按钮的文案必须原样出现在规格文案里——曾经这里写出过
      // 「首页叫中音区、练习页写全音域」这种同名两写的毛病
      expect(labels[index]).toContain(DIFFICULTY_TIERS[tier].label);
    });
    expect(labels[0]).toBe('3 个音 · 中音区');
    expect(labels[1]).toBe('3 个音 · 全音域');
    expect(labels[2]).toBe('3 个音 · 八度内');
  });

  it('宽音域档的题确实会用到中音区之外的音', () => {
    const generator = createExerciseGenerator(lcg(2024));
    const spec = createDrillSpecForTier('wide', 3);
    let outside = 0;
    for (let index = 0; index < 100; index += 1) {
      const exercise = generator.generate(spec, `wide-${index}`);
      if (exercise.pitches.some((pitch) => pitch < DEFAULT_RANGE.min || pitch > DEFAULT_RANGE.max)) {
        outside += 1;
      }
    }
    expect(outside).toBeGreaterThan(50);
  });
});

describe('判分器', () => {
  const judge = createRankOrderJudge();
  const spec: DrillSpec = createDrillSpec({ noteCount: 3, spanPattern: 'unrestricted' });

  it('排对了才算对；错一个就是错', () => {
    const exercise = createExerciseGenerator(fixedRandom([0, 0, 0, 0, 0, 0])).generate(spec, 'ex1');
    const correct = correctRanks(exercise);

    const rightAnswer = submitDraft(exercise, [...correct]);
    const judgment = judge.judge(exercise, rightAnswer);
    expect(judgment.isCorrect).toBe(true);
    expect(judgment.matchedCount).toBe(3);
    expect(judgment.details.map((detail) => detail.isCorrect)).toEqual([true, true, true]);

    // 交换前两个音的名次 -> 整题错
    const swapped = [...correct];
    const first = swapped[0] as number;
    swapped[0] = swapped[1] as number;
    swapped[1] = first;
    const wrong = judge.judge(exercise, submitDraft(exercise, swapped));
    expect(wrong.isCorrect).toBe(false);
    expect(wrong.matchedCount).toBe(1);
  });

  it('逐音明细同时给出「你填的」和「正确的」，供反馈使用', () => {
    const exercise = createExerciseGenerator(fixedRandom([0.2, 0.4, 0.6, 0.8, 0.1])).generate(spec, 'ex2');
    const correct = correctRanks(exercise);
    const reversed = [...correct].reverse();
    const judgment = judge.judge(exercise, submitDraft(exercise, reversed));

    judgment.details.forEach((detail, index) => {
      expect(detail.noteIndex).toBe(index);
      expect(detail.correctRank).toBe(correct[index]);
      expect(detail.answeredRank).toBe(reversed[index]);
    });
  });

  it('作答不是完整排列时判分器抛错（防止脏数据静默判对）', () => {
    const exercise = createExerciseGenerator(fixedRandom([0.3, 0.6, 0.9, 0.2, 0.5])).generate(spec, 'ex3');
    expect(() =>
      judge.judge(exercise, { exerciseId: 'ex3', ranks: [1, 1, 2] }),
    ).toThrow();
  });
});

describe('作答草稿', () => {
  const exercise = createExerciseGenerator(fixedRandom([0.4, 0.8, 0.2, 0.6, 0.9])).generate(
    createDrillSpec({ noteCount: 3, spanPattern: 'unrestricted' }),
    'ex1',
  );

  it('必须每个滑块都选、且档位不重复，才能提交', () => {
    let draft = createAnswerDraft(3);
    expect(isDraftSubmittable(draft, 3)).toBe(false);

    draft = setRankAt(draft, 0, 1);
    expect(isDraftSubmittable(draft, 3)).toBe(false);

    draft = setRankAt(draft, 1, 2);
    expect(isDraftSubmittable(draft, 3)).toBe(false);

    draft = setRankAt(draft, 2, 2); // 与第二个滑块重复
    expect(isDraftSubmittable(draft, 3)).toBe(false);

    draft = setRankAt(draft, 2, 3);
    expect(isDraftSubmittable(draft, 3)).toBe(true);
  });

  it('能算出「这个档位已被别的滑块占用」，供界面做提示', () => {
    const draft = setRankAt(setRankAt(createAnswerDraft(3), 0, 2), 1, 3);
    expect(ranksTakenByOthers(draft, 2)).toEqual(new Set([2, 3]));
    expect(ranksTakenByOthers(draft, 0)).toEqual(new Set([3]));
  });

  it('填满之后还能继续改：抢占已被占用的档位就是两个音互换', () => {
    const filled = [4, 3, 2, 1];

    // 第 1 个音改到第 2 位：占着第 2 位的第 3 个音接手第 4 位
    const swapped = assignRank(filled, 0, 2);
    expect(swapped).toEqual([2, 3, 4, 1]);
    // 交换完仍然是 1…4 的一个排列，改完可以直接提交
    expect(isDraftSubmittable(swapped, 4)).toBe(true);
    // 再点回来是同一套语义：答案永远改得动
    expect(assignRank(swapped, 0, 4)).toEqual([4, 3, 2, 1]);
  });

  it('提交未完成的作答会抛错', () => {
    expect(() => submitDraft(exercise, createAnswerDraft(3))).toThrow();
  });
});

describe('出题器与判分器的对偶关系', () => {
  it('把真实音高从低到高填进去，永远是正确答案', () => {
    const generator = createExerciseGenerator(lcg(4242));
    const judge = createRankOrderJudge();
    const spec = createDrillSpec({ noteCount: 4, spanPattern: 'within-octave' });

    for (let index = 0; index < 100; index += 1) {
      const exercise = generator.generate(spec, `ex${index}`);
      const answer = submitDraft(exercise, [...correctRanks(exercise)]);
      expect(judge.judge(exercise, answer).isCorrect).toBe(true);

      // 同时验证：名次与音高一一对应，反馈里的音名可以还原出排序
      const names = exercise.pitches.map(pitchToNoteName);
      const pitches = names.map(noteNameToPitch) as Semitones[];
      expect(positionsOf(pitches)).toEqual(correctRanks(exercise));
    }
  });
});
