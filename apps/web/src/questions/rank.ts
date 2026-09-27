/**
 * 排序题生成器：yuegan 的核心练习，接到 earpath 的题型协议上。
 *
 * 分工是刻意的：
 *   * **core 决定一切规则**——音数、音域、跨度上限、出题算法、正确答案、判分口径；
 *   * 本文件只做翻译工作：调 core、把音高序列交给 core 的播放端口（`playPitches`，时序也由
 *     core 的领域配置给出）、把判分结果换成界面协议。它不自己造播放事件，也不做音乐判断。
 *
 * 因此 `rank` 题型的业务规则在 packages/core 里有唯一一份（并带行为测试），
 * 这里既没有第二个出题器，也没有第二个判分器。
 */

import {
  createDrillSpecForTier,
  createExerciseGenerator,
  createMathRandomSource,
  createRankOrderJudge,
  spanOf,
  type RankSequence,
} from '@yuegan/core';
import type { RankLevel } from '../course/curriculum';
import { midiFromPitch, midiName } from '../i18n/domain-labels';
import type { GenerateContext, RankQuestion } from './types';

const generator = createExerciseGenerator(createMathRandomSource());
const judge = createRankOrderJudge();

let questionCounter = 0;

export function generateRank(
  level: RankLevel,
  levelIdx: number,
  ctx: GenerateContext,
): RankQuestion {
  // 规格是 core 的概念：音数 + 难度档 → 音域 + 跨度规则。这里只是把关卡的两项传进去。
  const spec = createDrillSpecForTier(level.tier, level.noteCount);
  questionCounter += 1;
  const exercise = generator.generate(spec, `rank-${level.id}-${questionCounter}`);

  // 音名与跨度在出题时算好并闭包住：重听放的一定是同一道题（音高序列不改）。
  const noteNames = exercise.pitches.map((pitch) => midiName(midiFromPitch(pitch)));

  return {
    kind: 'rank',
    moduleId: 'pitch',
    levelIdx,
    prompt: ctx.t(level.promptKey ?? 'module.pitch.rank.prompt'),
    howTo: ctx.t(level.howToKey ?? 'module.pitch.rank.howTo'),
    exercise,
    spec,
    noteCount: exercise.pitches.length,
    replayLimit: spec.replayLimit,
    noteNames,
    spanSemitones: spanOf(exercise.pitches),
    // 播放走 core 的 AudioPlayer 端口：音高序列来自 core，时序也来自 core 的领域配置。
    play: () => ctx.playPitches(exercise.pitches),
    grade(ranks: RankSequence) {
      const judgment = judge.judge(exercise, { exerciseId: exercise.id, ranks });
      return {
        result: {
          correct: judgment.isCorrect,
          // 技能项按「难度档 + 音数」记：这正是这一关练的东西。
          itemResults: [
            { key: `rk:${level.tier}:${level.noteCount}`, correct: judgment.isCorrect },
          ],
          confusion: null,
        },
        judgment,
      };
    },
  };
}
