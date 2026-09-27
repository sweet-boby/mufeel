/**
 * 出题入口：按模块与关卡派发到对应的生成器。
 *
 * 模块的 `kind` 决定题型；Pitch 模块内部又分成「比高低」（choice）与
 * 「排序」（rank）两种关卡，所以派发看的是**关卡**的 kind，而不是模块的。
 */

import { moduleById, type LevelDef, type ModuleDef } from '../curriculum';
import { generateCompare } from './compare';
import { generateInterval, generateChord, generateScale } from './choice-modules';
import { generateDegree, generateProgression } from './functional-modules';
import { generateMelody } from './melodies';
import { generateRank } from './rank';
import type { GenerateContext, Question } from './types';

export { resetPickState } from './shared';
export type { GenerateContext, Question } from './types';

function dispatch(mod: ModuleDef, level: LevelDef, levelIdx: number, ctx: GenerateContext): Question {
  switch (level.kind) {
    case 'compare':
      return generateCompare(mod, level, levelIdx, ctx);
    case 'rank':
      return generateRank(level, levelIdx, ctx);
    case 'intervals':
      return generateInterval(mod, level, levelIdx, ctx);
    case 'chords':
      return generateChord(mod, level, levelIdx, ctx);
    case 'scales':
      return generateScale(mod, level, levelIdx, ctx);
    case 'degrees':
      return generateDegree(mod, level, levelIdx, ctx);
    case 'progressions':
      return generateProgression(mod, level, levelIdx, ctx);
    case 'melodies':
      return generateMelody(mod, level, levelIdx, ctx);
  }
}

/** 生成一道题；模块或关卡不存在时返回 null（界面据此退回首页）。 */
export function generate(
  moduleId: string,
  levelIdx: number,
  ctx: GenerateContext,
): Question | null {
  const mod = moduleById(moduleId);
  const level = mod?.levels[levelIdx];
  if (mod === undefined || level === undefined) {
    return null;
  }
  return dispatch(mod, level, levelIdx, ctx);
}
