/**
 * 功能听觉：音级（单音在调里的位置）与级数（和弦进行）。
 *
 * 两题都先放一个终止式把调性立住，再问问题——练的是调性上下文，不是绝对音高。
 * 移植自 earpath-app 的 `genDegree` / `genProgression`。
 */

import type { DegreeLevel, ModuleDef, ProgressionLevel } from '../curriculum';
import { CADENCES, DEGREES, NUMERALS, choice, randInt } from '../theory';
import { cadenceEvents } from '../../infrastructure/audio/events';
import { eventsDuration, shiftEvents, type PlaybackEvent } from '../playback';
import { cadenceFor, pickWeighted, playFresh, voiceNumeral } from './shared';
import type { ChoiceQuestion, GenerateContext, QuestionResult, SequenceQuestion } from './types';

export function generateDegree(
  mod: ModuleDef,
  level: DegreeLevel,
  levelIdx: number,
  ctx: GenerateContext,
): ChoiceQuestion {
  const picked = pickWeighted(
    level.items.map((id) => ({ id, itemKey: `dg:${level.mode}:${id}` })),
    ctx,
  );
  const keyRoot = randInt(53, 64);
  const octave = level.wide === true ? choice([-12, 0, 12]) : choice([0, 12]);
  const noteMidi = keyRoot + (DEGREES[picked.id]?.semis ?? 0) + octave;

  const cadence = cadenceFor(keyRoot, level.mode, CADENCES);
  const noteAt = eventsDuration(cadence) + 0.55;
  const events: PlaybackEvent[] = [...cadence, { midi: noteMidi, at: noteAt, dur: 1.0 }];

  const labels = ctx.settings.degreeLabels;
  const labelOf = (id: string): string => {
    const degree = DEGREES[id];
    if (degree === undefined) {
      return id;
    }
    return labels === 'number' ? degree.number : degree.solfege;
  };
  const subOf = (id: string): string => {
    const degree = DEGREES[id];
    if (degree === undefined) {
      return '';
    }
    return labels === 'number' ? degree.solfege : degree.number;
  };

  return {
    kind: 'choice',
    moduleId: mod.id,
    levelIdx,
    prompt: ctx.t(level.promptKey ?? mod.promptKey),
    howTo: ctx.t(level.howToKey ?? mod.howToKey ?? mod.tipKey),
    options: level.items.map((id) => ({ id, label: labelOf(id), sub: subOf(id) })),
    answerId: picked.id,
    mnemonic: null,
    // 从与题目音相同的音区重放某个音级，方便对比
    playOption: (id: string) => {
      const semis = DEGREES[id]?.semis ?? 0;
      const candidates = [-12, 0, 12].map((o) => keyRoot + semis + o);
      const closest = candidates.reduce((a, b) =>
        Math.abs(b - noteMidi) < Math.abs(a - noteMidi) ? b : a,
      );
      return playFresh(ctx, [{ midi: closest, at: 0, dur: 1.0 }]);
    },
    play: () => playFresh(ctx, events),
    grade(answeredId: string) {
      const correct = answeredId === picked.id;
      return {
        correct,
        itemResults: [{ key: picked.itemKey, correct }],
        confusion: { correctId: picked.id, answeredId },
      };
    },
  };
}

export function generateProgression(
  mod: ModuleDef,
  level: ProgressionLevel,
  levelIdx: number,
  ctx: GenerateContext,
): SequenceQuestion {
  const tonic = level.mode === 'major' ? 'I' : 'i';
  const enders = level.pool.filter((n) => ['I', 'i', 'V', 'vi'].includes(n));

  const seq: string[] = [level.startTonic ? tonic : choice(level.pool)];
  for (let i = 1; i < level.length; i += 1) {
    let next = choice(level.pool);
    while (next === seq[i - 1]) {
      next = choice(level.pool);
    }
    seq.push(next);
  }
  // 真实进行一般会落在一个稳定和弦上
  const last = seq[seq.length - 1] as string;
  if (enders.length > 0 && Math.random() < 0.7 && !enders.includes(last)) {
    let replacement = choice(enders);
    while (replacement === seq[seq.length - 2]) {
      replacement = choice(enders);
    }
    seq[seq.length - 1] = replacement;
  }

  const keyRoot = randInt(50, 59);
  const cadence = cadenceFor(keyRoot, level.mode, CADENCES);
  let at = eventsDuration(cadence) + 0.8;
  const progressionEvents: PlaybackEvent[] = [];
  for (const numeral of seq) {
    progressionEvents.push({ midis: voiceNumeral(keyRoot, numeral), at, dur: 0.85, vel: 0.6 });
    at += 0.95;
  }

  const given = seq.map((_, i) => i === 0 && level.startTonic);
  const events = [...cadence, ...progressionEvents];

  return {
    kind: 'sequence',
    moduleId: mod.id,
    levelIdx,
    prompt: ctx.t(level.promptKey ?? mod.promptKey),
    howTo: ctx.t(level.howToKey ?? mod.howToKey ?? mod.tipKey),
    options: level.pool.map((id) => ({ id, label: NUMERALS[id]?.name ?? id })),
    answerSeq: seq,
    given,
    play: () => playFresh(ctx, events),
    playProgressionOnly: () =>
      playFresh(
        ctx,
        shiftEvents(progressionEvents, -(progressionEvents[0]?.at ?? 0)),
      ),
    grade(userSeq: readonly (string | null)[]): QuestionResult {
      const itemResults = [];
      let allCorrect = true;
      for (let i = 0; i < seq.length; i += 1) {
        const ok = userSeq[i] === seq[i];
        if (!ok) {
          allCorrect = false;
        }
        if (given[i] !== true) {
          itemResults.push({ key: `pg:${level.mode}:${seq[i]}`, correct: ok });
        }
      }
      return { correct: allCorrect, itemResults, confusion: null };
    },
  };
}

/**
 * 终止式事件的公开助手：旋律题也要用它，放在这里避免两个生成器各写一份。
 */
export const progressionCadence = (keyRoot: number, mode: string): PlaybackEvent[] =>
  cadenceEvents(CADENCES[mode]!.map((n) => ({ root: 0, semis: voiceNumeral(keyRoot, n) })));
