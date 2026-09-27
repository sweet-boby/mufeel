/**
 * 课程表：模块、关卡与解锁规则。
 *
 * 与 earpath-app 的 js/curriculum.js 同构，两处差别是有意的：
 *   1. 所有文案换成 i18n key（`nameKey` / `hintKey` / …），界面按当前语言翻译；
 *   2. Pitch 模块在原来 4 个「两个音比高低」关卡之后，接着 yuegan 的 n 音排序关卡
 *      （`kind: 'rank'`）——排序的难度由「音数 + 难度档」两个维度拉开，
 *      这两项直接映射到 @yuegan/core 的 DrillSpec 与 DIFFICULTY_TIERS，本文件不复制规则。
 *
 * 设计原则（沿袭 earpath，见其 README）：
 *   * 每个技能从「差别最大」的二选一开始，一次只多放进一两个选项；
 *   * 先旋律后和声、先大调后小调、先自然音后变化音；
 *   * 功能听觉（音级、级数）永远先给终止式，练的是调性上下文而不是绝对音高；
 *   * 每关的目标都用一句人话说清：「最近 WINDOW 题里答对 NEED 题」。
 */

import type { DifficultyTier } from '@yuegan/core';

export type ModuleId =
  | 'pitch'
  | 'intervals'
  | 'chords'
  | 'scales'
  | 'degrees'
  | 'progressions'
  | 'melodies';

/** 题型：三种沿袭 earpath，`rank` 是 yuegan 的排序题。 */
export type QuestionKind = 'choice' | 'sequence' | 'melody' | 'rank';

export type ModuleColor = 'sky' | 'violet' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'fuchsia';

interface LevelCommon {
  /** 稳定 id，用于 i18n key 命名与将来的成绩统计。 */
  readonly id: string;
  readonly nameKey: string;
  readonly hintKey: string;
  /** 覆盖模块级题面/做法说明（排序关卡用它，因为题面与「比高低」不同）。 */
  readonly promptKey?: string;
  readonly howToKey?: string;
}

/** 两个音比高低（earpath 的 Pitch 前四关）。 */
export interface CompareLevel extends LevelCommon {
  readonly kind: 'compare';
  readonly gap: readonly [number, number];
  readonly allowSame?: boolean;
}

export interface IntervalLevel extends LevelCommon {
  readonly kind: 'intervals';
  readonly dirs: readonly string[];
  readonly items: readonly string[];
}

export interface ChordLevel extends LevelCommon {
  readonly kind: 'chords';
  readonly items: readonly string[];
}

export interface ScaleLevel extends LevelCommon {
  readonly kind: 'scales';
  readonly items: readonly string[];
}

export interface DegreeLevel extends LevelCommon {
  readonly kind: 'degrees';
  readonly mode: 'major' | 'minor';
  readonly items: readonly string[];
  readonly wide?: boolean;
}

export interface ProgressionLevel extends LevelCommon {
  readonly kind: 'progressions';
  readonly mode: 'major' | 'minor';
  readonly length: number;
  readonly startTonic: boolean;
  readonly pool: readonly string[];
}

export interface MelodyLevel extends LevelCommon {
  readonly kind: 'melodies';
  readonly length: number;
  readonly degrees: readonly string[];
  readonly firstGiven: boolean;
  readonly leapy?: boolean;
  readonly chromatic?: number;
  readonly upperDo?: boolean;
}

/**
 * n 个音的排序题（yuegan 的核心练习）。
 *
 * 一关固定「音数 + 难度档」两项：音数决定几个滑块、几个档位，
 * 难度档决定出题音域与跨度规则——两者都原样交给 core 的 `createDrillSpecForTier`，
 * 这里只是把某一档摆到课程的哪一级台阶上。
 */
export interface RankLevel extends LevelCommon {
  readonly kind: 'rank';
  readonly noteCount: number;
  readonly tier: DifficultyTier;
}

export type LevelDef =
  | CompareLevel
  | IntervalLevel
  | ChordLevel
  | ScaleLevel
  | DegreeLevel
  | ProgressionLevel
  | MelodyLevel
  | RankLevel;

export interface ModuleDef {
  readonly id: ModuleId;
  readonly icon: string;
  readonly color: ModuleColor;
  readonly kind: QuestionKind;
  readonly titleKey: string;
  readonly promptKey: string;
  readonly howToKey?: string;
  readonly blurbKey: string;
  readonly tipKey: string;
  /** 关卡完成口径：最近 window 题里答对 need 题。 */
  readonly window: number;
  readonly need: number;
  readonly levels: readonly LevelDef[];
}

const compareLevel = (
  id: string,
  gap: readonly [number, number],
  allowSame = false,
): CompareLevel => ({
  kind: 'compare',
  id,
  nameKey: `module.pitch.level.${id}.name`,
  hintKey: `module.pitch.level.${id}.hint`,
  gap,
  ...(allowSame ? { allowSame: true } : {}),
});

const rankLevel = (
  id: string,
  noteCount: number,
  tier: DifficultyTier,
): RankLevel => ({
  kind: 'rank',
  id,
  noteCount,
  tier,
  nameKey: `module.pitch.level.${id}.name`,
  hintKey: `module.pitch.level.${id}.hint`,
  promptKey: 'module.pitch.rank.prompt',
  howToKey: 'module.pitch.rank.howTo',
});

export const MODULES: readonly ModuleDef[] = [
  {
    id: 'pitch',
    icon: '⇅',
    color: 'sky',
    kind: 'choice',
    titleKey: 'module.pitch.title',
    promptKey: 'module.pitch.prompt',
    howToKey: 'module.pitch.howTo',
    blurbKey: 'module.pitch.blurb',
    tipKey: 'module.pitch.tip',
    window: 12,
    need: 10,
    levels: [
      compareLevel('bigLeaps', [7, 12]),
      compareLevel('mediumSteps', [3, 6]),
      compareLevel('smallSteps', [1, 2]),
      compareLevel('fineTuning', [1, 1], true),
      // ↓ yuegan：从两个音升级到「一串音排出相对高低」。台阶按「音数变多 / 跨度变窄」两条轴走。
      rankLevel('order3', 3, 'standard'),
      rankLevel('order3Octave', 3, 'octave'),
      rankLevel('order4', 4, 'standard'),
      rankLevel('order5Wide', 5, 'wide'),
      rankLevel('order4Octave', 4, 'octave'),
      rankLevel('order5Octave', 5, 'octave'),
    ],
  },
  {
    id: 'intervals',
    icon: '⌒',
    color: 'violet',
    kind: 'choice',
    titleKey: 'module.intervals.title',
    promptKey: 'module.intervals.prompt',
    blurbKey: 'module.intervals.blurb',
    tipKey: 'module.intervals.tip',
    window: 12,
    need: 10,
    levels: [
      { kind: 'intervals', id: 'firstSteps', nameKey: 'module.intervals.level.firstSteps.name', hintKey: 'module.intervals.level.firstSteps.hint', dirs: ['a'], items: ['P8', 'P5'] },
      { kind: 'intervals', id: 'perfect4th', nameKey: 'module.intervals.level.perfect4th.name', hintKey: 'module.intervals.level.perfect4th.hint', dirs: ['a'], items: ['P8', 'P5', 'P4'] },
      { kind: 'intervals', id: 'seconds', nameKey: 'module.intervals.level.seconds.name', hintKey: 'module.intervals.level.seconds.hint', dirs: ['a'], items: ['P8', 'P5', 'P4', 'M2', 'm2'] },
      { kind: 'intervals', id: 'thirds', nameKey: 'module.intervals.level.thirds.name', hintKey: 'module.intervals.level.thirds.hint', dirs: ['a'], items: ['P8', 'P5', 'P4', 'M2', 'm2', 'M3', 'm3'] },
      { kind: 'intervals', id: 'tritone', nameKey: 'module.intervals.level.tritone.name', hintKey: 'module.intervals.level.tritone.hint', dirs: ['a'], items: ['P8', 'P5', 'P4', 'M2', 'm2', 'M3', 'm3', 'TT'] },
      { kind: 'intervals', id: 'sixths', nameKey: 'module.intervals.level.sixths.name', hintKey: 'module.intervals.level.sixths.hint', dirs: ['a'], items: ['P8', 'P5', 'P4', 'M2', 'm2', 'M3', 'm3', 'TT', 'M6', 'm6'] },
      { kind: 'intervals', id: 'sevenths', nameKey: 'module.intervals.level.sevenths.name', hintKey: 'module.intervals.level.sevenths.hint', dirs: ['a'], items: ['P8', 'P5', 'P4', 'M2', 'm2', 'M3', 'm3', 'TT', 'M6', 'm6', 'M7', 'm7'] },
      { kind: 'intervals', id: 'descendingI', nameKey: 'module.intervals.level.descendingI.name', hintKey: 'module.intervals.level.descendingI.hint', dirs: ['d'], items: ['P8', 'P5', 'P4', 'M3', 'm3'] },
      { kind: 'intervals', id: 'descendingII', nameKey: 'module.intervals.level.descendingII.name', hintKey: 'module.intervals.level.descendingII.hint', dirs: ['d'], items: ['P8', 'P5', 'P4', 'M2', 'm2', 'M3', 'm3', 'TT', 'M6', 'm6', 'M7', 'm7'] },
      { kind: 'intervals', id: 'harmonicI', nameKey: 'module.intervals.level.harmonicI.name', hintKey: 'module.intervals.level.harmonicI.hint', dirs: ['h'], items: ['P8', 'P5', 'P4', 'M3', 'm3', 'TT'] },
      { kind: 'intervals', id: 'harmonicII', nameKey: 'module.intervals.level.harmonicII.name', hintKey: 'module.intervals.level.harmonicII.hint', dirs: ['h'], items: ['P8', 'P5', 'P4', 'M2', 'm2', 'M3', 'm3', 'TT', 'M6', 'm6', 'M7', 'm7'] },
      { kind: 'intervals', id: 'allDirections', nameKey: 'module.intervals.level.allDirections.name', hintKey: 'module.intervals.level.allDirections.hint', dirs: ['a', 'd', 'h'], items: ['P8', 'P5', 'P4', 'M2', 'm2', 'M3', 'm3', 'TT', 'M6', 'm6', 'M7', 'm7'] },
      { kind: 'intervals', id: 'compound', nameKey: 'module.intervals.level.compound.name', hintKey: 'module.intervals.level.compound.hint', dirs: ['a'], items: ['M7', 'P8', 'm9', 'M9', 'P11', 'P12'] },
    ],
  },
  {
    id: 'chords',
    icon: '♬',
    color: 'amber',
    kind: 'choice',
    titleKey: 'module.chords.title',
    promptKey: 'module.chords.prompt',
    blurbKey: 'module.chords.blurb',
    tipKey: 'module.chords.tip',
    window: 12,
    need: 10,
    levels: [
      { kind: 'chords', id: 'majorMinor', nameKey: 'module.chords.level.majorMinor.name', hintKey: 'module.chords.level.majorMinor.hint', items: ['maj', 'min'] },
      { kind: 'chords', id: 'diminished', nameKey: 'module.chords.level.diminished.name', hintKey: 'module.chords.level.diminished.hint', items: ['maj', 'min', 'dim'] },
      { kind: 'chords', id: 'augmented', nameKey: 'module.chords.level.augmented.name', hintKey: 'module.chords.level.augmented.hint', items: ['maj', 'min', 'dim', 'aug'] },
      { kind: 'chords', id: 'sevenths', nameKey: 'module.chords.level.sevenths.name', hintKey: 'module.chords.level.sevenths.hint', items: ['dom7', 'maj7', 'min7'] },
      { kind: 'chords', id: 'darkerSevenths', nameKey: 'module.chords.level.darkerSevenths.name', hintKey: 'module.chords.level.darkerSevenths.hint', items: ['dom7', 'maj7', 'min7', 'm7b5', 'dim7'] },
      { kind: 'chords', id: 'triadsSevenths', nameKey: 'module.chords.level.triadsSevenths.name', hintKey: 'module.chords.level.triadsSevenths.hint', items: ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7', 'm7b5', 'dim7'] },
      { kind: 'chords', id: 'suspended', nameKey: 'module.chords.level.suspended.name', hintKey: 'module.chords.level.suspended.hint', items: ['maj', 'min', 'sus2', 'sus4'] },
      { kind: 'chords', id: 'inversions', nameKey: 'module.chords.level.inversions.name', hintKey: 'module.chords.level.inversions.hint', items: ['maj', 'maj_1', 'maj_2', 'min', 'min_1', 'min_2'] },
      { kind: 'chords', id: 'colourChords', nameKey: 'module.chords.level.colourChords.name', hintKey: 'module.chords.level.colourChords.hint', items: ['maj6', 'min6', 'maj7', 'min7', 'mM7'] },
      { kind: 'chords', id: 'ninths', nameKey: 'module.chords.level.ninths.name', hintKey: 'module.chords.level.ninths.hint', items: ['dom7', 'dom9', 'maj7', 'maj9', 'min7', 'min9'] },
      { kind: 'chords', id: 'gauntlet', nameKey: 'module.chords.level.gauntlet.name', hintKey: 'module.chords.level.gauntlet.hint', items: ['maj', 'min', 'dim', 'aug', 'sus4', 'dom7', 'maj7', 'min7', 'm7b5', 'dim7', 'mM7', 'maj6', 'min6'] },
    ],
  },
  {
    id: 'scales',
    icon: '𝄚',
    color: 'emerald',
    kind: 'choice',
    titleKey: 'module.scales.title',
    promptKey: 'module.scales.prompt',
    blurbKey: 'module.scales.blurb',
    tipKey: 'module.scales.tip',
    window: 12,
    need: 10,
    levels: [
      { kind: 'scales', id: 'majorMinor', nameKey: 'module.scales.level.majorMinor.name', hintKey: 'module.scales.level.majorMinor.hint', items: ['major', 'natmin'] },
      { kind: 'scales', id: 'threeMinors', nameKey: 'module.scales.level.threeMinors.name', hintKey: 'module.scales.level.threeMinors.hint', items: ['natmin', 'harmmin', 'melmin'] },
      { kind: 'scales', id: 'pentatonic', nameKey: 'module.scales.level.pentatonic.name', hintKey: 'module.scales.level.pentatonic.hint', items: ['majpent', 'minpent', 'blues'] },
      { kind: 'scales', id: 'modesI', nameKey: 'module.scales.level.modesI.name', hintKey: 'module.scales.level.modesI.hint', items: ['major', 'dorian', 'mixolydian', 'natmin'] },
      { kind: 'scales', id: 'modesII', nameKey: 'module.scales.level.modesII.name', hintKey: 'module.scales.level.modesII.hint', items: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] },
      { kind: 'scales', id: 'allModes', nameKey: 'module.scales.level.allModes.name', hintKey: 'module.scales.level.allModes.hint', items: ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'natmin', 'locrian'] },
      { kind: 'scales', id: 'exotic', nameKey: 'module.scales.level.exotic.name', hintKey: 'module.scales.level.exotic.hint', items: ['harmmin', 'phrygdom', 'wholetone', 'dimhw'] },
      { kind: 'scales', id: 'grandMix', nameKey: 'module.scales.level.grandMix.name', hintKey: 'module.scales.level.grandMix.hint', items: ['major', 'natmin', 'harmmin', 'melmin', 'majpent', 'minpent', 'blues', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'wholetone'] },
    ],
  },
  {
    id: 'degrees',
    icon: '◉',
    color: 'rose',
    kind: 'choice',
    titleKey: 'module.degrees.title',
    promptKey: 'module.degrees.prompt',
    howToKey: 'module.degrees.howTo',
    blurbKey: 'module.degrees.blurb',
    tipKey: 'module.degrees.tip',
    window: 12,
    need: 10,
    levels: [
      { kind: 'degrees', id: 'homeBase', nameKey: 'module.degrees.level.homeBase.name', hintKey: 'module.degrees.level.homeBase.hint', mode: 'major', items: ['do', 'mi', 'sol'] },
      { kind: 'degrees', id: 'reAndFa', nameKey: 'module.degrees.level.reAndFa.name', hintKey: 'module.degrees.level.reAndFa.hint', mode: 'major', items: ['do', 're', 'mi', 'fa', 'sol'] },
      { kind: 'degrees', id: 'fullMajor', nameKey: 'module.degrees.level.fullMajor.name', hintKey: 'module.degrees.level.fullMajor.hint', mode: 'major', items: ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'] },
      { kind: 'degrees', id: 'wideRange', nameKey: 'module.degrees.level.wideRange.name', hintKey: 'module.degrees.level.wideRange.hint', mode: 'major', items: ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'], wide: true },
      { kind: 'degrees', id: 'minorKey', nameKey: 'module.degrees.level.minorKey.name', hintKey: 'module.degrees.level.minorKey.hint', mode: 'minor', items: ['do', 're', 'me', 'fa', 'sol', 'le', 'te'] },
      { kind: 'degrees', id: 'chromatic', nameKey: 'module.degrees.level.chromatic.name', hintKey: 'module.degrees.level.chromatic.hint', mode: 'major', items: ['do', 'ra', 're', 'me', 'mi', 'fa', 'fi', 'sol', 'le', 'la', 'te', 'ti'] },
    ],
  },
  {
    id: 'progressions',
    icon: '⛓',
    color: 'cyan',
    kind: 'sequence',
    titleKey: 'module.progressions.title',
    promptKey: 'module.progressions.prompt',
    howToKey: 'module.progressions.howTo',
    blurbKey: 'module.progressions.blurb',
    tipKey: 'module.progressions.tip',
    window: 10,
    need: 7,
    levels: [
      { kind: 'progressions', id: 'primaryChords', nameKey: 'module.progressions.level.primaryChords.name', hintKey: 'module.progressions.level.primaryChords.hint', mode: 'major', length: 3, startTonic: true, pool: ['I', 'IV', 'V'] },
      { kind: 'progressions', id: 'popVi', nameKey: 'module.progressions.level.popVi.name', hintKey: 'module.progressions.level.popVi.hint', mode: 'major', length: 4, startTonic: true, pool: ['I', 'IV', 'V', 'vi'] },
      { kind: 'progressions', id: 'addIi', nameKey: 'module.progressions.level.addIi.name', hintKey: 'module.progressions.level.addIi.hint', mode: 'major', length: 4, startTonic: true, pool: ['I', 'ii', 'IV', 'V', 'vi'] },
      { kind: 'progressions', id: 'anyStart', nameKey: 'module.progressions.level.anyStart.name', hintKey: 'module.progressions.level.anyStart.hint', mode: 'major', length: 4, startTonic: false, pool: ['I', 'ii', 'iii', 'IV', 'V', 'vi'] },
      { kind: 'progressions', id: 'minorKey', nameKey: 'module.progressions.level.minorKey.name', hintKey: 'module.progressions.level.minorKey.hint', mode: 'minor', length: 4, startTonic: true, pool: ['i', 'iv', 'V', 'VI', 'VII'] },
      { kind: 'progressions', id: 'longerLines', nameKey: 'module.progressions.level.longerLines.name', hintKey: 'module.progressions.level.longerLines.hint', mode: 'major', length: 5, startTonic: false, pool: ['I', 'ii', 'iii', 'IV', 'V', 'vi'] },
    ],
  },
  {
    id: 'melodies',
    icon: '♪',
    color: 'fuchsia',
    kind: 'melody',
    titleKey: 'module.melodies.title',
    promptKey: 'module.melodies.prompt',
    howToKey: 'module.melodies.howTo',
    blurbKey: 'module.melodies.blurb',
    tipKey: 'module.melodies.tip',
    window: 10,
    need: 7,
    levels: [
      { kind: 'melodies', id: 'threeNotes', nameKey: 'module.melodies.level.threeNotes.name', hintKey: 'module.melodies.level.threeNotes.hint', length: 3, degrees: ['do', 're', 'mi'], firstGiven: true },
      { kind: 'melodies', id: 'fiveNoteRange', nameKey: 'module.melodies.level.fiveNoteRange.name', hintKey: 'module.melodies.level.fiveNoteRange.hint', length: 4, degrees: ['do', 're', 'mi', 'fa', 'sol'], firstGiven: true },
      { kind: 'melodies', id: 'fullScale', nameKey: 'module.melodies.level.fullScale.name', hintKey: 'module.melodies.level.fullScale.hint', length: 4, degrees: ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'], firstGiven: true, upperDo: true },
      { kind: 'melodies', id: 'leaps', nameKey: 'module.melodies.level.leaps.name', hintKey: 'module.melodies.level.leaps.hint', length: 5, degrees: ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'], firstGiven: true, leapy: true, upperDo: true },
      { kind: 'melodies', id: 'longerLines', nameKey: 'module.melodies.level.longerLines.name', hintKey: 'module.melodies.level.longerLines.hint', length: 6, degrees: ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'], firstGiven: false, upperDo: true },
      { kind: 'melodies', id: 'chromaticTouches', nameKey: 'module.melodies.level.chromaticTouches.name', hintKey: 'module.melodies.level.chromaticTouches.hint', length: 7, degrees: ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'], firstGiven: false, chromatic: 0.18, upperDo: true },
    ],
  },
];

export const moduleById = (id: string): ModuleDef | undefined => MODULES.find((m) => m.id === id);

/**
 * 入门路径：预解锁若干关卡，让有基础的人不必从头刷「比高低」。
 *
 * pitch 现在不只是「比高低」了，所以两条进阶路径都不再整块跳过它：
 * `basics` 只解锁前 4 关（比高低），`experienced` 才一路开到排序关卡。
 */
export const ONBOARDING_PATHS = {
  fresh: { labelKey: 'onboarding.path.fresh.label', descKey: 'onboarding.path.fresh.desc', unlocks: {} },
  basics: {
    labelKey: 'onboarding.path.basics.label',
    descKey: 'onboarding.path.basics.desc',
    unlocks: { pitch: 4, intervals: 4, chords: 3, scales: 1, degrees: 1, progressions: 1, melodies: 1 },
  },
  experienced: {
    labelKey: 'onboarding.path.experienced.label',
    descKey: 'onboarding.path.experienced.desc',
    unlocks: { pitch: 8, intervals: 9, chords: 7, scales: 4, degrees: 3, progressions: 3, melodies: 3 },
  },
} as const;

export type OnboardingPathId = keyof typeof ONBOARDING_PATHS;
