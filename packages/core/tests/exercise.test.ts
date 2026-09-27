import { describe, expect, it } from 'vitest';
import {
  createDrillSpec,
  createExerciseGenerator,
  createRankOrderJudge,
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

  it('能算出「这个档位已被别的滑块占用」，用于界面禁用', () => {
    const draft = setRankAt(setRankAt(createAnswerDraft(3), 0, 2), 1, 3);
    expect(ranksTakenByOthers(draft, 2)).toEqual(new Set([2, 3]));
    expect(ranksTakenByOthers(draft, 0)).toEqual(new Set([3]));
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
