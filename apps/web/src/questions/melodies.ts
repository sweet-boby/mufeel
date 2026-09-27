/**
 * 旋律听写生成器：听一小段旋律，再用屏幕键盘弹回来。
 *
 * 出题规则（允许哪些音、怎么走、什么时候变半音）在 `@yuegan/core` 的
 * `services/melody.ts` 里，本文件只做三件本地的事：
 *   1. 挑一个主音 —— 这是「这一关摆在哪」的出题策略，不是音乐事实；
 *   2. 把 core 规划的旋律变成播放事件（终止式 + 旋律）；
 *   3. 交点按键盘范围与判分。
 */

import { planMelody, type RandomSource } from '@yuegan/core';
import type { MelodyLevel, ModuleDef } from '../course/curriculum';
import { melodyEvents } from './events';
import { eventsDuration, shiftEvents, type PlaybackEvent } from './playback';
import { randInt } from './random';
import { cadenceFor, playFresh } from './shared';
import type { GenerateContext, MelodyQuestion } from './types';

/** 旋律用 Math.random 就够：这条旋律只活一道题，不需要跨端复现。 */
const webRandom: RandomSource = { next: () => Math.random() };

export function generateMelody(
  mod: ModuleDef,
  level: MelodyLevel,
  levelIdx: number,
  ctx: GenerateContext,
): MelodyQuestion {
  const keyRoot = randInt(55, 64);
  const plan = planMelody(
    {
      keyRoot,
      degrees: level.degrees,
      length: level.length,
      ...(level.upperDo === true ? { upperDo: true } : {}),
      ...(level.leapy === true ? { leapy: true } : {}),
      ...(level.chromatic === undefined ? {} : { chromatic: level.chromatic }),
    },
    webRandom,
  );

  const midis = [...plan.pitches];
  const top = plan.allowed[plan.allowed.length - 1] as number;
  const tempo = ctx.settings.melodyTempo;
  const cadence = cadenceFor(keyRoot, 'major');
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
