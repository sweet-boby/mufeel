/**
 * i18n 门禁（跑在 vitest 里）：
 *
 * 1. 中英两份字典的 key 必须完全一致——少一条就是界面上少一句文案；
 * 2. 同一条文案的插值占位符必须一致——否则换语言会丢参数（`{n}` 变字面量）；
 * 3. 源码里 `t('key')` 用到的 key 必须都存在——防手滑写错 key，界面直接显示 key 本身；
 * 4. 课程表与乐理数据里所有 `*Key` 字段必须都存在——这两处是动态拼 key 的重灾区。
 *
 * 用 `import.meta.glob` 读源码而不是 node:fs：浏览器包的 tsconfig 不引 node 类型，
 * 这样测试文件本身也能过 typecheck。
 */

import { describe, expect, it } from 'vitest';
import { MODULES, ONBOARDING_PATHS } from '../domain/curriculum';
import { CHORDS, DEGREES, DIRECTIONS, INTERVALS, SCALES } from '../domain/theory';
import { en } from './en';
import { placeholders } from './translate';
import { zh } from './zh';

const sources = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function usedKeys(): Map<string, string> {
  const found = new Map<string, string>();
  for (const [file, content] of Object.entries(sources)) {
    if (file.includes('/i18n/')) continue;
    for (const match of content.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      found.set(match[1] as string, file);
    }
  }
  return found;
}

describe('字典完整性', () => {
  it('中英 key 完全一致', () => {
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    expect(zhKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys.filter((key) => !zhKeys.includes(key))).toEqual([]);
    expect(zhKeys.length).toBeGreaterThan(200);
  });

  it('没有空文案', () => {
    for (const [lang, dict] of Object.entries({ zh, en })) {
      const empty = Object.entries(dict)
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => `${lang}:${key}`);
      expect(empty).toEqual([]);
    }
  });

  it('同一 key 在两种语言里的插值占位符一致', () => {
    const mismatched: string[] = [];
    for (const key of Object.keys(zh)) {
      const a = placeholders(zh[key] ?? '').sort();
      const b = placeholders(en[key] ?? '').sort();
      if (a.join(',') !== b.join(',')) {
        mismatched.push(`${key}: zh={${a}} en={${b}}`);
      }
    }
    expect(mismatched).toEqual([]);
  });
});

describe('源码引用的 key', () => {
  it('每个 t(\'...\') 都能在字典里找到', () => {
    const missing: string[] = [];
    for (const [key, file] of usedKeys()) {
      if (zh[key] === undefined) {
        missing.push(`${key} (${file})`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('课程表与乐理数据的 key', () => {
  it('模块与关卡的每一条文案都存在', () => {
    const missing: string[] = [];
    for (const mod of MODULES) {
      for (const key of [mod.titleKey, mod.blurbKey, mod.tipKey, mod.promptKey, mod.howToKey]) {
        if (key !== undefined && zh[key] === undefined) missing.push(key);
      }
      for (const level of mod.levels) {
        for (const key of [level.nameKey, level.hintKey, level.promptKey, level.howToKey]) {
          if (key !== undefined && zh[key] === undefined) missing.push(key);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('乐理数据的名字与参考曲目都存在', () => {
    const missing: string[] = [];
    for (const interval of Object.values(INTERVALS)) {
      if (zh[interval.nameKey] === undefined) missing.push(interval.nameKey);
      for (const songKey of Object.values(interval.songKeys ?? {})) {
        if (zh[songKey] === undefined) missing.push(songKey);
      }
    }
    for (const chord of Object.values(CHORDS)) {
      if (zh[chord.nameKey] === undefined) missing.push(chord.nameKey);
    }
    for (const scale of Object.values(SCALES)) {
      if (zh[scale.nameKey] === undefined) missing.push(scale.nameKey);
      if (scale.subKey !== undefined && zh[scale.subKey] === undefined) missing.push(scale.subKey);
    }
    for (const direction of Object.values(DIRECTIONS)) {
      if (zh[direction.nameKey] === undefined) missing.push(direction.nameKey);
    }
    // 音级标签（Do / 1）刻意不翻译，但它的数量要与字典无关地稳定
    expect(Object.keys(DEGREES)).toHaveLength(12);
    expect(missing).toEqual([]);
  });

  /**
   * 动态拼出来的 key 是门禁的盲区：`t('tier.' + level.tier)` 这类写法在源码里
   * 只是一个字符串拼接，扫不出具体取值，漏一条就会把 key 本身显示给用户。
   * 所以按课程表里真实出现的取值逐个查一遍。
   */
  it('动态拼出来的 key 也都在字典里', () => {
    const missing: string[] = [];

    // 1) 排序关卡的档位显示名：t(`tier.${level.tier}`)
    const tiers = new Set<string>();
    for (const mod of MODULES) {
      for (const level of mod.levels) {
        if (level.kind === 'rank') tiers.add(level.tier);
      }
    }
    expect(tiers.size).toBeGreaterThan(0);
    for (const tier of tiers) {
      for (const key of [`tier.${tier}`]) {
        if (zh[key] === undefined) missing.push(key);
      }
    }

    // 2) 音程模块的选项与提示：t(`theory.interval.${id}`) / t(`theory.direction.${dir}`)
    for (const mod of MODULES) {
      for (const level of mod.levels) {
        if (level.kind !== 'intervals') continue;
        for (const id of level.items) {
          if (zh[`theory.interval.${id}`] === undefined) missing.push(`theory.interval.${id}`);
        }
        for (const dir of level.dirs) {
          if (zh[`theory.direction.${dir}`] === undefined) missing.push(`theory.direction.${dir}`);
        }
      }
    }

    // 3) 比高低题型的三个选项：t(`module.pitch.option.${id}`)
    for (const id of ['up', 'down', 'same']) {
      if (zh[`module.pitch.option.${id}`] === undefined) missing.push(`module.pitch.option.${id}`);
    }

    // 4) 入门路径：t(path.labelKey) / t(path.descKey)
    for (const path of Object.values(ONBOARDING_PATHS)) {
      for (const key of [path.labelKey, path.descKey]) {
        if (zh[key] === undefined) missing.push(key);
      }
    }

    expect([...new Set(missing)]).toEqual([]);
  });
});
