/**
 * 旋律听写生成器：听一小段旋律，再用屏幕键盘弹回来。
 *
 * 允许出现的音严格等于本关声明的音级集合（外加关卡明确开启的高八度主音），
 * 不会冒出关卡没承诺过的音——旋律题最容易让人挫败的地方就是「出现了一个你没学过的音」。
 */

import type { MelodyLevel, ModuleDef } from '../curriculum';
import { DEGREES, choice, randInt, weightedChoice } from '../theory';
import { melodyEvents } from '../../infrastructure/audio/events';
import { eventsDuration, shiftEvents, type PlaybackEvent } from '../playback';
import { playFresh } from './shared';
import { progressionCadence } from './functional-modules';
import type { GenerateContext, MelodyQuestion } from './types';

export function generateMelody(
  mod: ModuleDef,
  level: MelodyLevel,
  levelIdx: number,
  ctx: GenerateContext,
): MelodyQuestion {
  const keyRoot = randInt(55, 64);
  const allowed = level.degrees.map((d) => keyRoot + (DEGREES[d]?.semis ?? 0));
  if (level.upperDo === true) {
    allowed.push(keyRoot + 12);
  }
  allowed.sort((a, b) => a - b);
  const top = allowed[allowed.length - 1] as number;

  const startPool =
    level.length <= 4
      ? [keyRoot]
      : [keyRoot, keyRoot + 4, keyRoot + 7].filter((m) => allowed.includes(m));
  let index = allowed.indexOf(startPool.length > 0 ? choice(startPool) : keyRoot);
  if (index < 0) {
    index = 0;
  }

  const stepWeights: readonly (readonly [number, number])[] =
    level.leapy === true
      ? [
          [-4, 1],
          [-3, 1.5],
          [-2, 2],
          [-1, 3],
          [1, 3],
          [2, 2],
          [3, 1.5],
          [4, 1],
        ]
      : [
          [-2, 1],
          [-1, 3.5],
          [1, 3.5],
          [2, 1],
        ];

  const midis: number[] = [allowed[index] as number];
  for (let i = 1; i < level.length; i += 1) {
    const moves = stepWeights.filter(([step]) => index + step >= 0 && index + step < allowed.length);
    const [step] = weightedChoice(
      moves,
      moves.map(([, weight]) => weight),
    );
    index += step;
    let midi = allowed[index] as number;
    if (level.chromatic !== undefined && Math.random() < level.chromatic && i < level.length - 1) {
      const alternative = midi + choice([-1, 1]);
      if (alternative > keyRoot - 1 && alternative < top + 1 && !allowed.includes(alternative)) {
        midi = alternative;
      }
    }
    midis.push(midi);
  }

  const tempo = ctx.settings.melodyTempo;
  const cadence = progressionCadence(keyRoot, 'major');
  const melodyStart = eventsDuration(cadence) + 0.7;
  const events: PlaybackEvent[] = [
    ...cadence,
    ...shiftEvents(melodyEvents(midis, tempo), melodyStart),
  ];

  return {
    kind: 'melody',
    moduleId: mod.id,
    levelIdx,
    prompt: ctx.t(level.promptKey ?? mod.promptKey),
    howTo: ctx.t(level.howToKey ?? mod.howToKey ?? mod.tipKey),
    targetMidis: midis,
    firstGiven: level.firstGiven,
    tonicMidi: keyRoot,
    keyRange: [keyRoot - 1, top + 1],
    play: () => playFresh(ctx, events),
    playMelodyOnly: () => playFresh(ctx, melodyEvents(midis, tempo)),
    grade(userMidis: readonly number[]) {
      let allCorrect = true;
      for (let i = 0; i < midis.length; i += 1) {
        if (userMidis[i] !== midis[i]) {
          allCorrect = false;
        }
      }
      return {
        correct: allCorrect,
        itemResults: [{ key: `ml:L${levelIdx}`, correct: allCorrect }],
        confusion: null,
      };
    },
  };
}
