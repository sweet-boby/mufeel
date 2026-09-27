/**
 * 进度与设置的唯一存档（基础设施层）。
 *
 * 从 earpath-app 的 js/state.js 移植，语义保持一致：按「技能项」和「关卡」两级记录
 * 答题历史，最近若干题的对错决定关卡是否完成、以及下一题该偏向哪个薄弱项。
 *
 * 与 React 的接缝只有一处：`useProgressVersion()`。状态本身故意做成可变对象
 * （和 earpath 一样），每次写入后 version 自增，订阅者据此重新渲染——
 * 这样答题热路径上不需要深拷贝整棵状态树。
 */

import { MODULES, moduleById } from '../course/curriculum';
import type { Lang } from '../i18n/types';
import { DEFAULT_LANG, isLang } from '../i18n/languages';

const KEY = 'yuegan.progress.v1';

export interface ItemStats {
  a: number;
  c: number;
  recent: number[];
}

export interface LevelStats extends ItemStats {
  completedAt: number | null;
}

export interface Settings {
  volume: number;
  autoAdvance: boolean;
  chordStyle: 'block' | 'block+arp' | 'arp';
  degreeLabels: 'solfege' | 'number';
  /** 旋律题的速度：每个音多少秒。 */
  melodyTempo: number;
  /** 自由模式：所有关卡解锁。 */
  freeRoam: boolean;
  language: Lang;
}

export interface ProgressState {
  version: 1;
  onboarded: boolean;
  settings: Settings;
  /** moduleId -> 入门路径预解锁的关卡数。 */
  preUnlock: Record<string, number>;
  items: Record<string, ItemStats>;
  levels: Record<string, LevelStats>;
  confusions: Record<string, number>;
  activity: Record<string, { a: number; c: number }>;
  streak: { current: number; best: number; lastDay: string | null };
  lastPracticed: string | null;
  totals: { a: number; c: number };
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.9,
  autoAdvance: true,
  chordStyle: 'block+arp',
  degreeLabels: 'solfege',
  melodyTempo: 0.55,
  freeRoam: false,
  language: DEFAULT_LANG,
};

function blank(): ProgressState {
  return {
    version: 1,
    onboarded: false,
    settings: { ...DEFAULT_SETTINGS },
    preUnlock: {},
    items: {},
    levels: {},
    confusions: {},
    activity: {},
    streak: { current: 0, best: 0, lastDay: null },
    lastPracticed: null,
    totals: { a: 0, c: 0 },
  };
}

let state: ProgressState = blank();
let version = 0;
const listeners = new Set<() => void>();

export function getState(): ProgressState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion(): number {
  return version;
}

function emit(): void {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
}

function normalizeSettings(raw: unknown): Settings {
  const input = (raw ?? {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    language: isLang(input.language) ? input.language : DEFAULT_SETTINGS.language,
  };
}

export function load(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const data = JSON.parse(raw) as Partial<ProgressState>;
      state = { ...blank(), ...data, settings: normalizeSettings(data.settings) };
    }
  } catch (error) {
    console.warn('yuegan: 读取存档失败', error);
  }
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('yuegan: 写入存档失败', error);
  }
}

export function resetAll(): void {
  state = blank();
  save();
  emit();
}

export function updateSettings(patch: Partial<Settings>): void {
  state.settings = { ...state.settings, ...patch };
  save();
  emit();
}

const today = (): string => new Date().toISOString().slice(0, 10);

function bumpStreak(): void {
  const day = today();
  const streak = state.streak;
  if (streak.lastDay === day) {
    return;
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  streak.current = streak.lastDay === yesterday ? streak.current + 1 : 1;
  streak.best = Math.max(streak.best, streak.current);
  streak.lastDay = day;
}

// ── 技能项与关卡统计 ──────────────────────────────────────────────────────────

const RECENT_CAP = 20;

export function itemStats(key: string): ItemStats {
  return state.items[key] ?? { a: 0, c: 0, recent: [] };
}

export function levelKey(moduleId: string, idx: number): string {
  return `${moduleId}:${idx}`;
}

export function levelStats(moduleId: string, idx: number): LevelStats {
  return state.levels[levelKey(moduleId, idx)] ?? { a: 0, c: 0, recent: [], completedAt: null };
}

/** 最近 n 题的正确率；没答过时返回 null（由权重函数负责优先出没见过的题）。 */
export function itemRecentAccuracy(key: string, n = 10): number | null {
  const recent = itemStats(key).recent.slice(-n);
  if (recent.length === 0) {
    return null;
  }
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/** 出题权重：没见过和最近老错的技能项更常出现。 */
export function itemWeight(key: string): number {
  const stats = itemStats(key);
  if (stats.a < 3) {
    return 3;
  }
  const accuracy = itemRecentAccuracy(key) ?? 0;
  return 1 + 4 * (1 - accuracy);
}

export interface ItemResult {
  key: string;
  correct: boolean;
}

export interface Confusion {
  correctId: string;
  answeredId: string;
}

/**
 * 记录一道题。`itemResults` 是这道题练到的每个技能项（序列题按槽位记多条），
 * `correct` 是整题对错，用来判断关卡是否完成。
 */
export function recordAnswer(
  moduleId: string,
  levelIdx: number,
  itemResults: readonly ItemResult[],
  correct: boolean,
  confusion: Confusion | null = null,
): { justCompleted: boolean } {
  for (const { key, correct: ok } of itemResults) {
    const stats = state.items[key] ?? { a: 0, c: 0, recent: [] };
    stats.a += 1;
    if (ok) {
      stats.c += 1;
    }
    stats.recent.push(ok ? 1 : 0);
    if (stats.recent.length > RECENT_CAP) {
      stats.recent.shift();
    }
    state.items[key] = stats;
  }

  const key = levelKey(moduleId, levelIdx);
  const stats = state.levels[key] ?? { a: 0, c: 0, recent: [], completedAt: null };
  stats.a += 1;
  if (correct) {
    stats.c += 1;
  }
  stats.recent.push(correct ? 1 : 0);
  if (stats.recent.length > RECENT_CAP) {
    stats.recent.shift();
  }
  state.levels[key] = stats;

  if (confusion !== null && confusion.correctId !== confusion.answeredId) {
    const confusionKey = `${moduleId}|${confusion.correctId}>${confusion.answeredId}`;
    state.confusions[confusionKey] = (state.confusions[confusionKey] ?? 0) + 1;
  }

  const day = today();
  const activity = state.activity[day] ?? { a: 0, c: 0 };
  activity.a += 1;
  if (correct) {
    activity.c += 1;
  }
  state.activity[day] = activity;

  state.totals.a += 1;
  if (correct) {
    state.totals.c += 1;
  }
  state.lastPracticed = moduleId;
  bumpStreak();

  // 关卡完成口径：答满 window 题之后，最近 window 题里对够 need 题。
  const mod = moduleById(moduleId);
  let justCompleted = false;
  if (mod !== undefined && stats.completedAt === null && stats.a >= mod.window) {
    const window = stats.recent.slice(-mod.window);
    const got = window.reduce((a, b) => a + b, 0);
    if (got >= mod.need) {
      stats.completedAt = Date.now();
      justCompleted = true;
    }
  }

  save();
  emit();
  return { justCompleted };
}

/** 关卡进度 0..1，用于圆环。 */
export function levelProgress(moduleId: string, idx: number): number {
  const mod = moduleById(moduleId);
  if (mod === undefined) {
    return 0;
  }
  const stats = levelStats(moduleId, idx);
  if (stats.completedAt !== null) {
    return 1;
  }
  const window = stats.recent.slice(-mod.window);
  const got = window.reduce((a, b) => a + b, 0);
  return Math.min(got / mod.need, 0.97); // 完成之前永远不显示满环
}

export function isLevelComplete(moduleId: string, idx: number): boolean {
  return levelStats(moduleId, idx).completedAt !== null;
}

export function isLevelUnlocked(moduleId: string, idx: number): boolean {
  if (state.settings.freeRoam) {
    return true;
  }
  if (idx === 0) {
    return true;
  }
  if ((state.preUnlock[moduleId] ?? 0) > idx) {
    return true;
  }
  return isLevelComplete(moduleId, idx - 1);
}

/** 「继续练习」该去哪一关：前沿之后第一个没完成且已解锁的关卡。 */
export function currentLevelIndex(moduleId: string): number {
  const mod = moduleById(moduleId);
  if (mod === undefined) {
    return 0;
  }
  const pre = Math.min(state.preUnlock[moduleId] ?? 0, mod.levels.length) - 1;
  let active = -1;
  for (let i = 0; i < mod.levels.length; i += 1) {
    if (levelStats(moduleId, i).a > 0) {
      active = i;
    }
  }
  const start = Math.max(0, pre, active);
  for (let i = start; i < mod.levels.length; i += 1) {
    if (!isLevelComplete(moduleId, i) && isLevelUnlocked(moduleId, i)) {
      return i;
    }
  }
  for (let i = 0; i < mod.levels.length; i += 1) {
    if (!isLevelComplete(moduleId, i) && isLevelUnlocked(moduleId, i)) {
      return i;
    }
  }
  return mod.levels.length - 1;
}

export function moduleCompletedCount(moduleId: string): number {
  const mod = moduleById(moduleId);
  if (mod === undefined) {
    return 0;
  }
  let done = 0;
  for (let i = 0; i < mod.levels.length; i += 1) {
    if (isLevelComplete(moduleId, i)) {
      done += 1;
    }
  }
  return done;
}

export function moduleStarted(moduleId: string): boolean {
  const mod = moduleById(moduleId);
  if (mod === undefined) {
    return false;
  }
  for (let i = 0; i < mod.levels.length; i += 1) {
    if (levelStats(moduleId, i).a > 0) {
      return true;
    }
  }
  return false;
}

/** 首页「继续」卡片推荐哪一关。 */
export function recommendation(): { moduleId: string; levelIdx: number } {
  const last = state.lastPracticed;
  if (last !== null && moduleById(last) !== undefined) {
    return { moduleId: last, levelIdx: currentLevelIndex(last) };
  }
  for (const mod of MODULES) {
    if ((state.preUnlock[mod.id] ?? 0) < mod.levels.length) {
      return { moduleId: mod.id, levelIdx: currentLevelIndex(mod.id) };
    }
  }
  return { moduleId: 'pitch', levelIdx: 0 };
}

export interface ConfusionRow {
  moduleId: string;
  correctId: string;
  answeredId: string;
  count: number;
}

export function topConfusions(limit = 8): ConfusionRow[] {
  return Object.entries(state.confusions)
    .map(([key, count]) => {
      const [moduleId = '', pair = ''] = key.split('|');
      const [correctId = '', answeredId = ''] = pair.split('>');
      return { moduleId, correctId, answeredId, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function applyOnboarding(unlocks: Record<string, number>): void {
  state.preUnlock = { ...unlocks };
  state.onboarded = true;
  save();
  emit();
}

// ── 导出 / 导入 ───────────────────────────────────────────────────────────────

export function exportJSON(): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text: string): void {
  const data = JSON.parse(text) as Partial<ProgressState>;
  if (typeof data !== 'object' || data === null || data.version !== 1) {
    throw new Error('invalid-backup');
  }
  state = { ...blank(), ...data, settings: normalizeSettings(data.settings) };
  save();
  emit();
}

// ── React 接线 ────────────────────────────────────────────────────────────────

export const progressStore = { getState, subscribe, getVersion };
