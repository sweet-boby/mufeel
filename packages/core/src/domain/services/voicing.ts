/**
 * 声部安排：把级数摆成一段听得清的柱式和弦。
 *
 * 这是纯算法，与「用哪个音色放出来」无关，所以住在 core（和 `assignSample` 同类）。
 * 规则：在同级数的三种排列（原位、一转、二转）× 三个八度里，挑平均音高最接近
 * `center` 的那一组，再在低八度补一个根音当贝斯——这样每个和弦都落在听觉的同一区域，
 * 用户不会因为「这个和弦碰巧被弹得很低」而听不出性质。
 */

import { numeralChordSemitones, numeralContent } from '../content/numerals';

export function voiceNumeral(keyRoot: number, numeralId: string, center = 64): number[] {
  const numeral = numeralContent(numeralId);
  const chordRoot = keyRoot + numeral.root;
  const base = numeralChordSemitones(numeralId);
  const [first = 0, second = 4, third = 7] = base;

  const inversions: readonly (readonly number[])[] = [
    [first, second, third],
    [second, third, first + 12],
    [third, first + 12, second + 12],
  ];

  let best: number[] = [];
  let bestDistance = Infinity;
  for (const inversion of inversions) {
    for (const octave of [-12, 0, 12]) {
      const notes = inversion.map((step) => chordRoot + step + octave);
      const average = notes.reduce((sum, note) => sum + note, 0) / notes.length;
      const distance = Math.abs(average - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = notes;
      }
    }
  }

  // 贝斯固定落在 MIDI 41–52（F2–E3）之间，与和弦本体的声部无关。
  let bass = chordRoot;
  while (bass > 52) bass -= 12;
  while (bass < 41) bass += 12;

  return [bass, ...best];
}
