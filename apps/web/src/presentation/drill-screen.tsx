/**
 * 练习界面：听音、拖滑块、提交、看反馈。
 *
 * 这一层不含任何规则：每个滑块有哪些档位、哪个档位被占用、能不能提交、
 * 还能听几次——全部来自 core 产出的 view state。
 *
 * 版式：滑块是**竖向**的，所有滑块**并排**成一行——一个音一列，列从左到右就是播放顺序，
 * 列内往上拖 = 档位数字变大 = 这个音更高。「越高越靠上」和听感方向一致，
 * 5 个音也不会像 5 条横滑块那样把页面拉得很长。
 */

import { formatInterval, formatRank, type DrillViewState, type NoteView } from '@yuegan/core';
import type { JSX } from 'react';

export interface DrillScreenProps {
  state: DrillViewState;
  onTogglePlay: () => void;
  onSelectRank: (noteIndex: number, rank: number) => void;
  onProposeRank: (noteIndex: number, rank: number) => void;
  onSubmit: () => void;
  onNext: () => void;
  onQuit: () => void;
}

function NoteSlider({
  note,
  noteCount,
  locked,
  onSelectRank,
  onProposeRank,
}: {
  note: NoteView;
  noteCount: number;
  locked: boolean;
  onSelectRank: (noteIndex: number, rank: number) => void;
  onProposeRank: (noteIndex: number, rank: number) => void;
}): JSX.Element {
  const feedback = note.feedback;

  return (
    <div className={feedback === null ? 'note-col' : `note-col ${feedback.isCorrect ? 'is-right' : 'is-wrong'}`}>
      <span className="note-label">第 {note.noteIndex + 1} 个音</span>

      <div className="slider-stack">
        <input
          className="slider"
          type="range"
          min={1}
          max={noteCount}
          step={1}
          value={note.sliderValue}
          disabled={locked}
          aria-label={`第 ${note.noteIndex + 1} 个音排第几`}
          list={`ticks-${note.noteIndex}`}
          // 按下时只记录「停在哪一档」用于显示。
          // 千万不能在这里用 currentTarget.value 提交答案：原生 range 在 pointerdown 时
          // 还没把 value 更新到新位置，读到的是旧值（点第二个滑块会先提交「第 1 位」，
          // 把已经排好的第一个滑块挤成未作答）。
          onPointerDown={(event) => onProposeRank(note.noteIndex, Number(event.currentTarget.value))}
          // 指针抬起后才提交：此时 value 已经是用户真正选中的档位。
          onPointerUp={(event) => onSelectRank(note.noteIndex, Number(event.currentTarget.value))}
          onKeyDown={(event) => {
            // 键盘：必须 preventDefault 并且一次性算到目标档位。
            // 若让原生步进 + 我们的受控更新各走一步，按一次方向键会跳两格；
            // 若只 preventDefault 不自己提交，方向键就完全没反应。
            // 竖向滑块上「上」= 音更高，所以上/右同为 +1，下/左同为 −1，两套键都留着。
            const delta =
              event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                ? -1
                : event.key === 'ArrowRight' || event.key === 'ArrowUp'
                  ? 1
                  : 0;
            if (delta === 0) {
              return;
            }
            event.preventDefault();
            const base = note.selectedRank ?? note.sliderValue;
            const next = Math.min(noteCount, Math.max(1, base + delta));
            onProposeRank(note.noteIndex, next);
            onSelectRank(note.noteIndex, next);
          }}
          onChange={(event) => onSelectRank(note.noteIndex, Number(event.target.value))}
        />
        <datalist id={`ticks-${note.noteIndex}`}>
          {note.options.map((option) => (
            <option key={option.rank} value={option.rank} label={option.label} />
          ))}
        </datalist>

        {/* 档位刻度：数字大的在上面，与滑块的上下方向一致 */}
        <div className="ticks" aria-hidden="true">
          {note.options.map((option) => (
            <span
              key={option.rank}
              className={[
                'tick',
                option.isSelected ? 'is-selected' : '',
                option.isProposed ? 'is-proposed' : '',
                option.isTakenByOther ? 'is-taken' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={option.isTakenByOther ? '这个位置已经被别的滑块占了' : option.label}
            >
              {option.rank}
            </span>
          ))}
        </div>
      </div>

      <span className={note.hasSelection ? 'note-value' : 'note-value is-empty'}>
        {note.hasSelection ? formatRank(note.selectedRank) : '未选择'}
      </span>

      {feedback !== null && (
        <div className="note-feedback">
          <span className={feedback.isCorrect ? 'tag tag-right' : 'tag tag-wrong'}>
            {feedback.isCorrect ? '排对了' : '排错了'}
          </span>
          <span className="muted">
            你填 <span className="nowrap">{formatRank(feedback.answeredRank)}</span>
          </span>
          <span className="muted">
            正确 <span className="nowrap">{formatRank(feedback.correctRank)}</span>
          </span>
          <span className="note-truth">
            真实音高 <strong>{feedback.noteName}</strong>
          </span>
          {feedback.intervalFromPrevious !== null && (
            <span className="muted" title={`与上一个音相差 ${feedback.intervalFromPrevious.semitones} 个半音`}>
              与上音 {formatInterval(feedback.intervalFromPrevious)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function DrillScreen({
  state,
  onTogglePlay,
  onSelectRank,
  onProposeRank,
  onSubmit,
  onNext,
  onQuit,
}: DrillScreenProps): JSX.Element {
  if (state.phase === 'loading-audio') {
    return (
      <div className="screen center">
        <div className="loading-card">
          <h2>正在准备钢琴音色</h2>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${Math.round(state.loadProgress * 100)}%` }} />
          </div>
          <p className="muted">{Math.round(state.loadProgress * 100)}% · 采样只需加载一次</p>
        </div>
      </div>
    );
  }

  const exercise = state.exercise;
  if (exercise === null) {
    return (
      <div className="screen center">
        <div className="loading-card">
          <h2>练习还没开始</h2>
          <button type="button" className="primary" onClick={onQuit}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const revealed = state.phase === 'revealed';
  const replaysLeft = state.replayLimit - state.replaysUsed;
  const allChosen = exercise.notes.every((note) => note.selectedRank !== null);

  return (
    <div className="screen drill">
      <header className="drill-head">
        <div className="drill-progress">
          第 <strong>{exercise.exerciseNumber}</strong> / {state.exerciseTotal} 题
          <span className="muted"> · {state.specLabel}</span>
        </div>
        <div className="drill-score">
          本局 {state.correctSoFar}/{state.answeredSoFar}
        </div>
        <button type="button" className="ghost" onClick={onQuit}>
          结束
        </button>
      </header>

      <section className="card listen-card">
        <div className="listen-row">
          <button
            type="button"
            className={state.isPlaying ? 'play is-playing' : 'play'}
            onClick={onTogglePlay}
            disabled={state.isPlaying || (!revealed && replaysLeft <= 0)}
          >
            {state.isPlaying ? '正在播放…' : revealed ? '再听一遍（对照）' : '再听一遍'}
          </button>
          {!revealed && (
            <span className="muted">
              还可以重听 {Math.max(replaysLeft, 0)} 次
            </span>
          )}
        </div>
        <p className="hint">
          共 {exercise.noteCount} 个音，按播放顺序从左到右各占一列；把每个滑块上下拖到它该在的位置。
          数字越大 = 音越高（每列都是上高下低）。
        </p>
      </section>

      <section className={revealed ? 'card slider-card is-revealed' : 'card slider-card'}>
        <div className="slider-row">
          {exercise.notes.map((note) => (
            <NoteSlider
              key={note.noteIndex}
              note={note}
              noteCount={exercise.noteCount}
              locked={revealed || state.isPlaying}
              onSelectRank={onSelectRank}
              onProposeRank={onProposeRank}
            />
          ))}
        </div>

        {!revealed ? (
          <button
            type="button"
            className="primary submit"
            onClick={onSubmit}
            disabled={!state.canSubmit}
          >
            {state.canSubmit ? '提交答案' : allChosen ? '每个位置只能用一次' : '把每个滑块都放好'}
          </button>
        ) : (
          <div className="verdict">
            <div className={state.judgment?.isCorrect === true ? 'verdict-text is-right' : 'verdict-text is-wrong'}>
              {state.judgment?.isCorrect === true ? '答对了' : '答错了'}
            </div>
            <p className="muted">
              真实音高：{(exercise.truthNoteNames ?? []).join(' → ')}
              {exercise.truthSpanSemitones !== null && ` · 整题跨度 ${exercise.truthSpanSemitones} 个半音`}
            </p>
            <button type="button" className="primary" onClick={onNext}>
              {exercise.exerciseNumber >= state.exerciseTotal ? '看结果' : '下一题'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
