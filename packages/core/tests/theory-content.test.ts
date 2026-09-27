import { describe, expect, it } from 'vitest';
import {
  CADENCES,
  CHORDS,
  DEGREES,
  INTERVALS,
  NUMERALS,
  SCALES,
  allowedMelodyPitches,
  cadenceNumerals,
  chordSemitones,
  degreeSemitones,
  intervalSemitones,
  numeralChordSemitones,
  numeralContent,
  planMelody,
  scaleSemitones,
  voiceNumeral,
  type RandomSource,
} from '../src/index';

/** 确定性随机源（与 exercise.test.ts 同一个 LCG），用来复现同一条旋律。 */
function lcg(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

/** 升序且严格递增（没有重复音）。 */
const isStrictlyAscending = (values: readonly number[]): boolean =>
  values.every((value, index) => index === 0 || value > (values[index - 1] as number));

describe('内容表的结构', () => {
  it('音程：半音数为正、记号为非空，且十二个基本音程恰好是 1…12', () => {
    for (const [id, content] of Object.entries(INTERVALS)) {
      expect(content.semitones, id).toBeGreaterThan(0);
      expect(Number.isInteger(content.semitones), id).toBe(true);
      expect(content.short.length, id).toBeGreaterThan(0);
    }
    const basics = ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
    expect(basics.map(intervalSemitones)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('音程：同一半音数不会被两个 id 冒名顶替', () => {
    const bySemitones = new Map<number, string[]>();
    for (const [id, content] of Object.entries(INTERVALS)) {
      bySemitones.set(content.semitones, [...(bySemitones.get(content.semitones) ?? []), id]);
    }
    for (const [semitones, ids] of bySemitones) {
      expect(ids.length, `半音数 ${semitones} 对应 ${ids.join('/')}`).toBe(1);
    }
  });

  it('和弦：每个排列都从 0 开始、严格递增、不超过两个八度', () => {
    for (const [id, content] of Object.entries(CHORDS)) {
      expect(content.semitones[0], id).toBe(0);
      expect(isStrictlyAscending(content.semitones), id).toBe(true);
      expect(Math.max(...content.semitones), id).toBeLessThanOrEqual(24);
      expect(content.semitones.length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('音阶：每个公式从 0 开始、以 12 结束、严格递增', () => {
    for (const [id, content] of Object.entries(SCALES)) {
      expect(content.semitones[0], id).toBe(0);
      expect(content.semitones[content.semitones.length - 1], id).toBe(12);
      expect(isStrictlyAscending(content.semitones), id).toBe(true);
    }
  });

  it('音级：十二个 id 恰好覆盖 0…11，唱名与级数记号都不重复', () => {
    expect(Object.keys(DEGREES)).toHaveLength(12);
    expect(Object.values(DEGREES).map((d) => d.semitones).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(new Set(Object.values(DEGREES).map((d) => d.solfege)).size).toBe(12);
    expect(new Set(Object.values(DEGREES).map((d) => d.number)).size).toBe(12);
  });
});

describe('级数与终止式', () => {
  it('每个级数的根音落在 0…11，且性质指向真实存在的和弦', () => {
    for (const [id, content] of Object.entries(NUMERALS)) {
      expect(content.root, id).toBeGreaterThanOrEqual(0);
      expect(content.root, id).toBeLessThan(12);
      expect(CHORDS[content.quality], `${id} → ${content.quality}`).toBeDefined();
      // 面向用户的名字（I / IV / vi）与 id 一致，平台侧不用另抄一份
      expect(id).toBe(id.trim());
    }
  });

  it('终止式只引用真实存在的级数（大小调各一个）', () => {
    for (const mode of ['major', 'minor']) {
      const numerals = cadenceNumerals(mode);
      expect(numerals.length, mode).toBeGreaterThan(0);
      for (const numeral of numerals) {
        expect(NUMERALS[numeral], `${mode}: ${numeral}`).toBeDefined();
      }
      // 终止式要落回主和弦：最后一个级数必须是该调的主级数
      expect(numerals[numerals.length - 1]).toBe(mode === 'major' ? 'I' : 'i');
    }
    expect(Object.keys(CADENCES).sort()).toEqual(['major', 'minor']);
  });

  it('级数取到的和弦排列与和弦表一致，不是另抄一份', () => {
    expect(numeralChordSemitones('I')).toEqual(CHORDS['maj']?.semitones);
    expect(numeralChordSemitones('ii')).toEqual(CHORDS['min']?.semitones);
    expect(numeralChordSemitones('V')).toEqual(CHORDS['maj']?.semitones);
    expect(numeralContent('vi').root).toBe(9);
  });
});

describe('声部安排（voiceNumeral）', () => {
  it('返回贝斯 + 三个和弦音，且和弦本体落在 center 附近', () => {
    for (const numeralId of Object.keys(NUMERALS)) {
      for (const keyRoot of [50, 55, 60, 64]) {
        const notes = voiceNumeral(keyRoot, numeralId, 64);
        expect(notes, `${numeralId}@${keyRoot}`).toHaveLength(4);

        const [bass, ...upper] = notes as [number, number, number, number];
        // 贝斯固定在 F2–E3，和声本体在它上面
        expect(bass).toBeGreaterThanOrEqual(41);
        expect(bass).toBeLessThanOrEqual(52);
        expect(Math.min(...upper)).toBeGreaterThan(bass);

        const average = upper.reduce((sum, note) => sum + note, 0) / upper.length;
        expect(Math.abs(average - 64), `${numeralId}@${keyRoot} 平均音高 ${average}`).toBeLessThan(12);

        // 和弦本体是「根音 + 该级数的排列」的某个转位：音级差的多重集不变
        const numeral = numeralContent(numeralId);
        const chordRoot = keyRoot + numeral.root;
        const expected = [...numeralChordSemitones(numeralId)].map((step) => step % 12).sort();
        const actual = upper.map((note) => (((note - chordRoot) % 12) + 12) % 12).sort();
        expect(actual, `${numeralId}@${keyRoot}`).toEqual(expected);
      }
    }
  });

  it('任何级数 × 任何主音，声部都落在 C2–C6 之内（不会跑到极端音区）', () => {
    for (const numeralId of Object.keys(NUMERALS)) {
      for (let keyRoot = 45; keyRoot <= 67; keyRoot += 1) {
        const notes = voiceNumeral(keyRoot, numeralId, 64);
        const lowest = Math.min(...notes);
        const highest = Math.max(...notes);
        expect(lowest, `${numeralId}@${keyRoot}`).toBeGreaterThanOrEqual(36); // C2
        expect(highest, `${numeralId}@${keyRoot}`).toBeLessThanOrEqual(84); // C6
      }
    }
  });
});

describe('旋律规划（planMelody）', () => {
  const options = {
    keyRoot: 60,
    degrees: ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'],
    length: 5,
    upperDo: true,
  } as const;

  it('允许音高集合 = 音级表推出的一组音，升序且以主音开头', () => {
    const allowed = allowedMelodyPitches(options);
    expect(allowed[0]).toBe(60);
    expect(allowed[allowed.length - 1]).toBe(72);
    expect(isStrictlyAscending(allowed)).toBe(true);
    expect(allowed).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('200 条旋律：音数固定、全部落在允许集合内、第一音是主音（短句）', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const plan = planMelody(options, lcg(seed));
      expect(plan.pitches).toHaveLength(options.length);
      for (const pitch of plan.pitches) {
        expect(plan.allowed, `seed ${seed} 出现了 ${pitch}`).toContain(pitch);
      }
      expect(plan.pitches[0]).toBe(60);
    }
  });

  it('跳进关确实会出现大跳，级进关不会超过三度', () => {
    let leapyJumps = 0;
    let stepwiseJumps = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const stepwise = planMelody({ ...options, leapy: false }, lcg(seed)).pitches;
      for (let i = 1; i < stepwise.length; i += 1) {
        const distance = Math.abs((stepwise[i] as number) - (stepwise[i - 1] as number));
        expect(distance).toBeLessThanOrEqual(4);
        if (distance >= 3) stepwiseJumps += 1;
      }
      const leapy = planMelody({ ...options, leapy: true }, lcg(seed)).pitches;
      for (let i = 1; i < leapy.length; i += 1) {
        if (Math.abs((leapy[i] as number) - (leapy[i - 1] as number)) >= 5) leapyJumps += 1;
      }
    }
    // 只断言上界会被「永远出级进」骗过，所以再要求跳进关真的跳出过五度以上
    expect(stepwiseJumps).toBeGreaterThan(0);
    expect(leapyJumps).toBeGreaterThan(0);
  });

  it('变化音只出现在本关音域内，且不会与已有音级重复', () => {
    let touched = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const plan = planMelody({ ...options, chromatic: 0.5 }, lcg(seed));
      const allowedSet = new Set(plan.allowed);
      for (const pitch of plan.pitches) {
        expect(pitch).toBeGreaterThanOrEqual(60 - 1);
        expect(pitch).toBeLessThanOrEqual(72 + 1);
        if (!allowedSet.has(pitch)) {
          touched += 1;
          // 变化音只能是某个允许音的邻音
          expect(plan.allowed.some((a) => Math.abs(a - pitch) === 1)).toBe(true);
        }
      }
      // 最后一个音不变半音：结尾要落在稳定的音级上
      const last = plan.pitches[plan.pitches.length - 1] as number;
      if (!allowedSet.has(last)) throw new Error('最后一个音不该是变化音');
    }
    expect(touched).toBeGreaterThan(0);
  });

  it('未知音级与非法长度会抛错，而不是悄悄出一首别的旋律', () => {
    expect(() => planMelody({ ...options, degrees: ['nope'] }, lcg(1))).toThrow(/未知音级/);
    expect(() => planMelody({ ...options, length: 0 }, lcg(1))).toThrow(/至少要有 1 个音/);
  });
});

describe('查表函数对未知 id 的态度', () => {
  it('一律抛错并带上 id', () => {
    expect(() => intervalSemitones('nope')).toThrow(/nope/);
    expect(() => chordSemitones('nope')).toThrow(/nope/);
    expect(() => scaleSemitones('nope')).toThrow(/nope/);
    expect(() => degreeSemitones('nope')).toThrow(/nope/);
    expect(() => numeralContent('nope')).toThrow(/nope/);
    expect(() => cadenceNumerals('nope')).toThrow(/nope/);
  });
});
