/**
 * 音程 / 和弦 / 音阶三个「选项式」生成器。
 *
 * 三个都遵循同一套形状：从本关允许的条目里按薄弱度抽一个 → 定一个根音 →
 * 生成音频事件 → 把选项标签按当前语言翻好。判分都是「选项 id 是否等于答案 id」，
 * 混淆对（考点 vs 误选）交给存档层统计，用于统计页的「最容易混淆」。
 */

import { CHORDS, INTERVALS, SCALES } from '@yuegan/core';
import type { ChordLevel, IntervalLevel, ModuleDef, ScaleLevel } from '../course/curriculum';
import {
  chordNameKey,
  INTERVAL_SONG_KEYS,
  intervalNameKey,
  SCALE_SUB_KEYS,
  scaleNameKey,
} from '../i18n/domain-labels';
import { randInt } from './random';
import { chordEvents, intervalEvents, scaleEvents } from './events';
import { pickWeighted, playFresh } from './shared';
import type { ChoiceQuestion, GenerateContext } from './types';

const confusionOf = (answerId: string, answeredId: string) => ({ correctId: answerId, answeredId });

export function generateInterval(
  mod: ModuleDef,
  level: IntervalLevel,
  levelIdx: number,
  ctx: GenerateContext,
): ChoiceQuestion {
  const candidates = level.items.flatMap((id) =>
    level.dirs.map((dir) => ({ id, dir, itemKey: `iv:${id}:${dir}` })),
  );
  const picked = pickWeighted(candidates, ctx);
  const semis = INTERVALS[picked.id]?.semitones ?? 0;

  // 两个音都留在 C3–C6（48–84）以内
  let rootLo = 48;
  let rootHi = 72;
  if (picked.dir === 'd') {
    rootLo = Math.max(48, 48 + semis);
  } else {
    rootHi = Math.min(72, 84 - semis);
  }
  const root = randInt(rootLo, Math.max(rootLo, rootHi));
  const events = intervalEvents(root, semis, picked.dir);

  const optionIds = [...new Set(level.items)];
  const songKey =
    picked.dir === 'd' ? INTERVAL_SONG_KEYS[picked.id]?.desc : INTERVAL_SONG_KEYS[picked.id]?.asc;

  return {
    kind: 'choice',
    moduleId: mod.id,
    levelIdx,
    prompt: ctx.t(level.promptKey ?? mod.promptKey),
    howTo: ctx.t(level.howToKey ?? mod.howToKey ?? mod.tipKey),
    options: optionIds.map((id) => ({
      id,
      label: ctx.t(intervalNameKey(id)),
      sub: INTERVALS[id]?.short ?? id,
    })),
    answerId: picked.id,
    mnemonic:
      songKey !== undefined && picked.dir !== 'h'
        ? ctx.t('practice.mnemonic', {
            name: ctx.t(intervalNameKey(picked.id)),
            direction: ctx.t(`theory.direction.${picked.dir}`),
            song: ctx.t(songKey),
          })
        : null,
    playOption: (id: string) =>
      playFresh(ctx, intervalEvents(root, INTERVALS[id]?.semitones ?? 0, picked.dir)),
    play: () => playFresh(ctx, events),
    grade(answeredId: string) {
      const correct = answeredId === picked.id;
      return {
        correct,
        itemResults: [{ key: picked.itemKey, correct }],
        confusion: confusionOf(picked.id, answeredId),
      };
    },
  };
}

export function generateChord(
  mod: ModuleDef,
  level: ChordLevel,
  levelIdx: number,
  ctx: GenerateContext,
): ChoiceQuestion {
  const picked = pickWeighted(
    level.items.map((id) => ({ id, itemKey: `ch:${id}` })),
    ctx,
  );
  const semis = CHORDS[picked.id]?.semitones ?? [0, 4, 7];
  const maxOffset = Math.max(...semis);
  // 声部围绕中央 C，最高音不超过 A5 附近
  const root = randInt(55, Math.max(55, Math.min(67, 81 - maxOffset)));
  const style = ctx.settings.chordStyle;

  return {
    kind: 'choice',
    moduleId: mod.id,
    levelIdx,
    prompt: ctx.t(level.promptKey ?? mod.promptKey),
    howTo: ctx.t(level.howToKey ?? mod.howToKey ?? mod.tipKey),
    options: level.items.map((id) => ({
      id,
      label: ctx.t(chordNameKey(id)),
      sub: CHORDS[id]?.short ?? id,
    })),
    answerId: picked.id,
    mnemonic: null,
    playOption: (id: string) => playFresh(ctx, chordEvents(root, CHORDS[id]?.semitones ?? [], style)),
    play: () => playFresh(ctx, chordEvents(root, semis, style)),
    grade(answeredId: string) {
      const correct = answeredId === picked.id;
      return {
        correct,
        itemResults: [{ key: picked.itemKey, correct }],
        confusion: confusionOf(picked.id, answeredId),
      };
    },
  };
}

export function generateScale(
  mod: ModuleDef,
  level: ScaleLevel,
  levelIdx: number,
  ctx: GenerateContext,
): ChoiceQuestion {
  const picked = pickWeighted(
    level.items.map((id) => ({ id, itemKey: `sc:${id}` })),
    ctx,
  );
  const root = randInt(53, 67);

  return {
    kind: 'choice',
    moduleId: mod.id,
    levelIdx,
    prompt: ctx.t(level.promptKey ?? mod.promptKey),
    howTo: ctx.t(level.howToKey ?? mod.howToKey ?? mod.tipKey),
    options: level.items.map((id) => {
      const subKey = SCALE_SUB_KEYS[id];
      return {
        id,
        label: ctx.t(scaleNameKey(id)),
        ...(subKey === undefined ? {} : { sub: ctx.t(subKey) }),
      };
    }),
    answerId: picked.id,
    mnemonic: null,
    playOption: (id: string) => playFresh(ctx, scaleEvents(root, SCALES[id]?.semitones ?? [])),
    play: () => playFresh(ctx, scaleEvents(root, SCALES[picked.id]?.semitones ?? [])),
    grade(answeredId: string) {
      const correct = answeredId === picked.id;
      return {
        correct,
        itemResults: [{ key: picked.itemKey, correct }],
        confusion: confusionOf(picked.id, answeredId),
      };
    },
  };
}
