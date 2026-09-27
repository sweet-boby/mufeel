/**
 * 点得响的屏幕键盘（旋律听写用）。
 *
 * 从 earpath-app 的 js/piano.js 移植：黑白键按百分比定位，范围会扩到白键边缘，
 * 所以任何音域都能正好铺满容器、不会出现横向滚动（滚动键盘会在拖动时误触琴键）。
 * 声音由父组件的 onKey 负责，这里只管画和点。
 */

import { forwardRef, useImperativeHandle, useRef, useState, type JSX } from 'react';
import { midiName } from '../../i18n/domain-labels';
import { useT } from '../../i18n';

const isBlack = (midi: number): boolean => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

export interface PianoHandle {
  flash(midi: number, cls?: string, ms?: number): void;
  clear(): void;
  highlight(midi: number, cls?: string): void;
}

export interface PianoProps {
  lo: number;
  hi: number;
  tonic?: number;
  enabled?: boolean;
  onKey(midi: number): void;
}

export const Piano = forwardRef<PianoHandle, PianoProps>(function Piano(
  { lo, hi, tonic, enabled = true, onKey },
  ref,
): JSX.Element {
  const t = useT();
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [flashes, setFlashes] = useState<Record<number, string>>({});
  const timers = useRef<number[]>([]);

  useImperativeHandle(ref, () => ({
    flash(midi, cls = 'hl', ms = 450) {
      setFlashes((prev) => ({ ...prev, [midi]: cls }));
      const timer = window.setTimeout(() => {
        setFlashes((prev) => {
          const next = { ...prev };
          delete next[midi];
          return next;
        });
      }, ms);
      timers.current.push(timer);
    },
    highlight(midi, cls = 'hl') {
      setMarks((prev) => ({ ...prev, [midi]: cls }));
    },
    clear() {
      setMarks({});
      setFlashes({});
    },
  }));

  let low = lo;
  let high = hi;
  while (isBlack(low)) low -= 1;
  while (isBlack(high)) high += 1;

  const whites: number[] = [];
  for (let midi = low; midi <= high; midi += 1) {
    if (!isBlack(midi)) whites.push(midi);
  }
  const width = 100 / whites.length;

  const press = (midi: number): void => {
    if (!enabled) return;
    onKey(midi);
  };

  const classOf = (midi: number, base: string): string => {
    const extra: string[] = [];
    if (tonic !== undefined && midi % 12 === tonic % 12) extra.push('tonic');
    if (marks[midi] !== undefined) extra.push(marks[midi] as string);
    if (flashes[midi] !== undefined) extra.push(flashes[midi] as string);
    return [base, ...extra].join(' ');
  };

  return (
    <div
      className={enabled ? 'piano' : 'piano disabled'}
      role="group"
      aria-label={t('practice.keyboard')}
      style={{ maxWidth: `${whites.length * 64}px` }}
    >
      {whites.map((midi, index) => (
        <button
          key={midi}
          type="button"
          className={classOf(midi, 'pkey white')}
          style={{ left: `${index * width}%`, width: `${width}%` }}
          aria-label={midiName(midi)}
          onPointerDown={(event) => {
            event.preventDefault();
            press(midi);
          }}
        >
          {tonic !== undefined && midi % 12 === tonic % 12 ? <span className="tonic-dot" /> : null}
        </button>
      ))}
      {Array.from({ length: high - low + 1 }, (_, i) => low + i)
        .filter((midi) => isBlack(midi))
        .map((midi) => {
          const prevWhiteIdx = whites.findIndex((white) => white > midi) - 1;
          return (
            <button
              key={midi}
              type="button"
              className={classOf(midi, 'pkey black')}
              style={{
                left: `${(prevWhiteIdx + 1) * width - width * 0.3}%`,
                width: `${width * 0.6}%`,
              }}
              aria-label={midiName(midi)}
              onPointerDown={(event) => {
                event.preventDefault();
                press(midi);
              }}
            />
          );
        })}
    </div>
  );
});
