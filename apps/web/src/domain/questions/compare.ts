/**
 * 「两个音比高低」生成器（Pitch 模块前四关）。
 *
 * 移植自 earpath-app 的 `genPitch`：只比方向，不涉及音名，
 * 是排序题的入门台阶——排序题要求同时握住 n 个音的相对位置。
 */

import type { CompareLevel, ModuleDef } from '../curriculum';
import { randInt } from '../theory';
import type { ChoiceQuestion, GenerateContext } from './types';
import { pickWeighted, playFresh } from './shared';

export function generateCompare(
  mod: ModuleDef,
  level: CompareLevel,
  levelIdx: number,
  ctx: GenerateContext,
): ChoiceQuestion {
  const ids = level.allowSame === true ? ['up', 'down', 'same'] : ['up', 'down'];
  const picked = pickWeighted(
    ids.map((id) => ({ id, itemKey: `pi:${id}` })),
    ctx,
  );
  const gap = picked.id === 'same' ? 0 : randInt(level.gap[0], level.gap[1]);

  let lo = 48;
  let hi = 76;
  if (picked.id === 'up') hi -= gap;
  if (picked.id === 'down') lo += gap;
  const first = randInt(lo, hi);
  const second = picked.id === 'up' ? first + gap : picked.id === 'down' ? first - gap : first;

  const events = [
    { midi: first, at: 0, dur: 0.7 },
    { midi: second, at: 0.88, dur: 0.7 },
  ];

  return {
    kind: 'choice',
    moduleId: mod.id,
    levelIdx,
    prompt: ctx.t(level.promptKey ?? mod.promptKey),
    howTo: ctx.t(level.howToKey ?? mod.howToKey ?? mod.promptKey),
    options: ids.map((id) => ({ id, label: ctx.t(`module.pitch.option.${id}`) })),
    answerId: picked.id,
    mnemonic: null,
    playOption: null,
    play: () => playFresh(ctx, events),
    grade(answeredId: string) {
      const correct = answeredId === picked.id;
      return {
        correct,
        itemResults: [{ key: `pi:${picked.id}`, correct }],
        confusion: null,
      };
    },
  };
}
