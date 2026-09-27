/**
 * 音级内容表：id → 主音之上的半音偏移，以及两种语言无关的记号。
 *
 * 唱名（Do / Re / Mi）与级数（1 / ♭3）是记谱记号，中英文里写法相同，
 * 所以跟着表走；「用唱名还是用数字」是平台的显示设置，不在这里。
 */

export interface DegreeContent {
  readonly semitones: number;
  readonly solfege: string;
  readonly number: string;
}

export const DEGREES: Record<string, DegreeContent> = {
  do: { semitones: 0, solfege: 'Do', number: '1' },
  ra: { semitones: 1, solfege: 'Ra', number: '♭2' },
  re: { semitones: 2, solfege: 'Re', number: '2' },
  me: { semitones: 3, solfege: 'Me', number: '♭3' },
  mi: { semitones: 4, solfege: 'Mi', number: '3' },
  fa: { semitones: 5, solfege: 'Fa', number: '4' },
  fi: { semitones: 6, solfege: 'Fi', number: '♯4' },
  sol: { semitones: 7, solfege: 'Sol', number: '5' },
  le: { semitones: 8, solfege: 'Le', number: '♭6' },
  la: { semitones: 9, solfege: 'La', number: '6' },
  te: { semitones: 10, solfege: 'Te', number: '♭7' },
  ti: { semitones: 11, solfege: 'Ti', number: '7' },
};

export const DEGREE_IDS: readonly string[] = Object.keys(DEGREES);

export function degreeSemitones(id: string): number {
  const content = DEGREES[id];
  if (content === undefined) {
    throw new Error(`未知音级：${id}`);
  }
  return content.semitones;
}
