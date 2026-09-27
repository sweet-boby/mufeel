/**
 * 题型协议：一道题在界面上长什么样、怎么判、怎么放音。
 *
 * 三种题型沿袭 earpath-app（choice / sequence / melody），`rank` 是 yuegan 的排序题。
 * 生成器负责把一切算好并闭包住（题目自带音频、正确答案、判分函数），
 * 界面只按协议渲染、把用户操作交回去——界面里不出现任何音乐判断。
 */

import type { DrillSpec, Exercise, Judgment, PlaybackTiming, RankSequence, Semitones } from '@yuegan/core';
import type { TFunc } from '../i18n/types';
import type { PlaybackEvent } from './playback';

/** 一个技能项的一次对错，交给存档层累计（薄弱项据此加权）。 */
export interface ItemResult {
  key: string;
  correct: boolean;
}

/** 「把 A 听成了 B」，用于统计页的「最容易混淆」。 */
export interface Confusion {
  correctId: string;
  answeredId: string;
}

export interface QuestionResult {
  correct: boolean;
  itemResults: ItemResult[];
  confusion: Confusion | null;
}

export interface ChoiceOption {
  id: string;
  label: string;
  sub?: string;
}

export interface QuestionCommon {
  readonly moduleId: string;
  readonly levelIdx: number;
  readonly prompt: string;
  /** 做法说明，显示在题面下方。 */
  readonly howTo: string;
  /** 播放这道题（重听也走它）。 */
  play(): Promise<void>;
}

export interface ChoiceQuestion extends QuestionCommon {
  readonly kind: 'choice';
  readonly options: readonly ChoiceOption[];
  readonly answerId: string;
  /** 参考曲目提示，答错时显示。 */
  readonly mnemonic: string | null;
  /** 从同一个根音重放某个选项，便于对比（没有就返回 null）。 */
  readonly playOption: ((id: string) => Promise<void>) | null;
  grade(answeredId: string): QuestionResult;
}

export interface SequenceQuestion extends QuestionCommon {
  readonly kind: 'sequence';
  readonly options: readonly ChoiceOption[];
  /** 正确级数序列。 */
  readonly answerSeq: readonly string[];
  /** 哪些槽位是给定的提示（用户仍要自己按一遍）。 */
  readonly given: readonly boolean[];
  playProgressionOnly(): Promise<void>;
  grade(userSeq: readonly (string | null)[]): QuestionResult;
}

export interface MelodyQuestion extends QuestionCommon {
  readonly kind: 'melody';
  readonly targetMidis: readonly number[];
  /** 是否把第一个音作为提示显示。 */
  readonly firstGiven: boolean;
  readonly tonicMidi: number;
  /** 键盘范围，保证所有可能的答案都画得下。 */
  readonly keyRange: readonly [number, number];
  playMelodyOnly(): Promise<void>;
  grade(userMidis: readonly number[]): QuestionResult;
}

/**
 * 排序题：听一串音，把每个音放到正确的相对高低位置。
 *
 * 规则一行都不在这里：题目由 core 的出题器生成，正确答案由 `correctRanks` 唯一确定，
 * 判分由 core 的判分器给出。这一层只负责翻译成界面要的形状。
 */
export interface RankQuestion extends QuestionCommon {
  readonly kind: 'rank';
  readonly exercise: Exercise;
  readonly spec: DrillSpec;
  readonly noteCount: number;
  /** 本题允许主动重听几次（首次播放不算）。 */
  readonly replayLimit: number;
  /** 仅反馈阶段使用：每个音的真实音名。 */
  readonly noteNames: readonly string[];
  /** 仅反馈阶段使用：整题跨度（半音）。 */
  readonly spanSemitones: number;
  grade(ranks: RankSequence): { result: QuestionResult; judgment: Judgment };
}

export type Question = ChoiceQuestion | SequenceQuestion | MelodyQuestion | RankQuestion;

/** 出题上下文：语言、权重、播放、以及几个影响出题的设置项。 */
export interface GenerateContext {
  readonly t: TFunc;
  /** 技能项出题权重（薄弱项更常出现）。 */
  weight(key: string): number;
  /**
   * 播放一串事件（由基础设施的采样引擎实现）。
   * earpath 侧的题型需要和弦、终止式这类带精确时间轴的材料，所以直接给事件。
   */
  play(events: readonly PlaybackEvent[]): Promise<void>;
  /**
   * 走 core 的 `AudioPlayer` 端口播放一串音高（排序题专用）。
   * 时序由 core 的领域配置给出，播放器不写死节奏——这是 ADR 0001 那条端口边界在 web 上的落点。
   */
  playPitches(pitches: readonly Semitones[], timing?: PlaybackTiming): Promise<void>;
  readonly settings: {
    readonly chordStyle: 'block' | 'block+arp' | 'arp';
    readonly degreeLabels: 'solfege' | 'number';
    readonly melodyTempo: number;
  };
}
