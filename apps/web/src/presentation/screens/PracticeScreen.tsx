/**
 * 练习页：题面、播放、四种作答方式、反馈与结算。
 *
 * 四种作答对应四种题型：
 *   choice   选项按钮（比高低 / 音程 / 和弦 / 音阶 / 音级）
 *   sequence 逐槽填级数（和弦进行）
 *   melody   屏幕键盘弹回旋律（听写）
 *   rank     给 n 个音排出相对高低（yuegan 的排序题）
 *
 * 这一层不做任何音乐判断：题目自带答案与判分函数，界面只渲染与转发。
 * 排序题的草稿由 core 的 `assignRank` 维护（档位被占时的互换语义也在 core 里）。
 */

import { useEffect, useRef, type JSX, type RefObject } from 'react';
import { intervalBetween } from '@yuegan/core';
import { moduleById } from '../../course/curriculum';
import type { RankQuestion } from '../../questions/types';
import { midiName } from '../../i18n/domain-labels';
import { useT } from '../../i18n';
import * as Progress from '../../infrastructure/progress';
import { pianoEngine } from '../../infrastructure/audio/piano-engine';
import { moduleColor } from '../components/Chrome';
import { Piano, type PianoHandle } from '../components/Piano';
import { go, useProgressVersion } from '../hooks';
import { useSession, type Session, type SessionConfig } from '../useSession';

const DAILY_TOTAL = 15;

export function PracticeScreen({
  moduleId,
  levelIdx,
}: {
  moduleId: string;
  levelIdx: number;
}): JSX.Element {
  const t = useT();
  const mod = moduleById(moduleId);
  const level = mod?.levels[levelIdx];

  if (mod === undefined || level === undefined) {
    return (
      <div className="page">
        <p className="muted">{t('practice.notFound')}</p>
        <button type="button" className="btn" onClick={() => go('#/')}>
          {t('common.home')}
        </button>
      </div>
    );
  }

  return (
    <SessionView
      cfg={{ mode: 'level', moduleId, levelIdx }}
      title={t(mod.titleKey)}
      subtitle={`${t('practice.level', { n: levelIdx + 1 })} · ${t(level.nameKey)}`}
      color={mod.color}
      backTo={`#/module/${moduleId}`}
    />
  );
}

export function DailyScreen(): JSX.Element {
  const t = useT();
  return (
    <SessionView
      cfg={{ mode: 'daily', dailyTotal: DAILY_TOTAL }}
      title={t('home.daily')}
      subtitle={t('home.dailySub')}
      color="amber"
      backTo="#/"
    />
  );
}

interface SessionViewProps {
  cfg: SessionConfig;
  title: string;
  subtitle: string;
  color: string;
  backTo: string;
}

function SessionView({ cfg, title, subtitle, color, backTo }: SessionViewProps): JSX.Element {
  const t = useT();
  useProgressVersion();
  const session = useSession(cfg);
  const { state, question: q } = session;
  const pianoRef = useRef<PianoHandle>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const answered = state.answered;
  const result = state.result;

  // 键盘快捷键：1–9 作答 · R 重听 · ⏎ 下一题 · ⌫ 撤销
  useEffect(() => {
    const onKeydown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
        return;
      }
      if (state.overlay !== 'none') {
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        session.play();
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!session.started || !session.audioReady) {
          session.start();
        } else if (answered) {
          session.next();
        } else if (!state.everPlayed) {
          session.play();
        } else if (q?.kind === 'rank') {
          session.submitRank();
        }
        return;
      }
      if (event.key === 'Backspace') {
        if (q?.kind === 'sequence') {
          event.preventDefault();
          session.undoSlot();
        }
        if (q?.kind === 'melody') {
          event.preventDefault();
          session.undoMelodyNote();
        }
        return;
      }
      if (/^[0-9]$/.test(event.key) && !answered && q !== null) {
        const index = event.key === '0' ? 9 : Number(event.key) - 1;
        if (q.kind === 'choice' && q.options[index] !== undefined) {
          session.choose(q.options[index]!.id);
        } else if (q.kind === 'sequence' && q.options[index] !== undefined) {
          session.fillSlot(q.options[index]!.id);
        } else if (q.kind === 'rank') {
          // 数字键 = 给「还没排的第一个音」选档位
          const column = state.rankDraft.findIndex((value) => value === null);
          const rank = index + 1;
          if (column >= 0 && rank <= q.noteCount) {
            session.assign(column, rank);
          }
        }
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [answered, q, session, state.everPlayed, state.overlay, state.rankDraft]);

  /**
   * 答完题后把操作区滚进视野。
   *
   * 排序题与旋律题的作答区很高（n 列档位梯 / 一个键盘），反馈一出现，「下一题」就被挤到首屏之外——
   * 用户得自己往下滚才能继续，看起来就像「答完没反应」。这里只在确实超出视野时滚最少的一段，
   * 并留出 ACTION_MARGIN 的余量，别让按钮贴着屏幕底边。
   */
  useEffect(() => {
    if (!answered) {
      return;
    }
    const target = actionsRef.current;
    if (target === null) {
      return;
    }
    const ACTION_MARGIN = 16;
    const rect = target.getBoundingClientRect();
    const belowBy = rect.bottom + ACTION_MARGIN - window.innerHeight;
    const aboveBy = rect.top - ACTION_MARGIN;
    const delta = belowBy > 0 ? belowBy : aboveBy < 0 ? aboveBy : 0;
    if (delta === 0) {
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: delta, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [answered]);

  // ── 还没开始：先让用户点一下（同时解锁浏览器音频） ─────────────────────────
  if (!session.started) {
    return (
      <div className="session" style={moduleColor(color)}>
        <SessionHead title={title} subtitle={subtitle} score="" onBack={() => go(backTo)} />
        <main className="s-body">
          <div className="s-stage">
            <button type="button" className="playbtn" onClick={session.start} aria-label={t('practice.start')}>
              ▶
            </button>
            <div className="s-prompt">{t('practice.tapToStart')}</div>
            <div className="s-howto">{t('practice.audioNote')}</div>
          </div>
        </main>
      </div>
    );
  }

  if (!session.audioReady) {
    return (
      <div className="session" style={moduleColor(color)}>
        <SessionHead title={title} subtitle={subtitle} score="" onBack={() => go(backTo)} />
        <main className="s-body">
          <div className="s-stage">
            <div className="s-prompt">{t('practice.loadingAudio')}</div>
            <div className="progress">
              <div className="progress-bar" style={{ width: `${Math.round(session.loadProgress * 100)}%` }} />
            </div>
            <div className="s-howto">
              {Math.round(session.loadProgress * 100)}% · {t('practice.loadOnce')}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (q === null) {
    return (
      <div className="session" style={moduleColor(color)}>
        <SessionHead title={title} subtitle={subtitle} score="" onBack={() => go(backTo)} />
        <main className="s-body" />
      </div>
    );
  }

  const mod = moduleById(q.moduleId);
  const score =
    cfg.mode === 'daily'
      ? `${state.dailyDone}/${cfg.dailyTotal ?? DAILY_TOTAL} · ✓ ${state.correctCount}`
      : `${t('practice.score')} ${state.correctCount}/${state.answeredCount}`;

  return (
    <div className="session" style={moduleColor(mod?.color ?? color)}>
      <SessionHead title={title} subtitle={subtitle} score={score} onBack={() => go(backTo)} />

      <main className="s-body">
        <div className="s-stage">
          <button
            type="button"
            className={state.playing ? 'playbtn playing' : 'playbtn'}
            onClick={session.play}
            disabled={session.replayDisabled}
            aria-label={t('practice.replay')}
          >
            {state.playing ? '…' : state.everPlayed ? '↻' : '▶'}
          </button>
          {cfg.mode === 'daily' && mod !== undefined ? (
            <div className="s-chip">
              {mod.icon} {t(mod.titleKey)}
            </div>
          ) : null}
          <div className="s-prompt">{q.prompt}</div>
          <div className="s-howto">{q.howTo}</div>
          {session.goalText !== null ? <div className="s-goal">{session.goalText}</div> : null}
          {q.kind === 'rank' && !answered ? (
            <div className="s-goal">
              {t('practice.replaysLeft', { n: Math.max(session.replaysLeft ?? 0, 0) })}
            </div>
          ) : null}
        </div>

        <div className="s-answers">
          {q.kind === 'choice' ? (
            <ChoiceAnswer session={session} />
          ) : q.kind === 'sequence' ? (
            <SequenceAnswer session={session} />
          ) : q.kind === 'melody' ? (
            <MelodyAnswer session={session} pianoRef={pianoRef} />
          ) : (
            <RankAnswer session={session} question={q} />
          )}
        </div>

        <div className="s-feedback">
          {result !== null ? (
            <div className={result.correct ? 'fb good' : 'fb bad'}>
              <div className="fb-line">{result.correct ? t('practice.correct') : t('practice.notQuite')}</div>
              {q.kind === 'choice' ? <ChoiceFeedback session={session} /> : null}
              {q.kind === 'sequence' ? <SequenceFeedback session={session} /> : null}
              {q.kind === 'melody' ? <MelodyFeedback session={session} pianoRef={pianoRef} /> : null}
              {q.kind === 'rank' ? <RankFeedback session={session} question={q} /> : null}
            </div>
          ) : null}
        </div>

        <div className="s-actions" ref={actionsRef}>
          {answered && state.overlay === 'none' ? (
            <button type="button" className="btn primary" onClick={session.next}>
              {state.pendingCelebration ? t('practice.seeResult') : t('practice.next')} →
            </button>
          ) : null}
        </div>
      </main>

      {state.overlay === 'level' ? (
        <LevelOverlay session={session} moduleId={q.moduleId} levelIdx={q.levelIdx} />
      ) : null}
      {state.overlay === 'daily' ? <DailyOverlay session={session} total={cfg.dailyTotal ?? DAILY_TOTAL} /> : null}
    </div>
  );
}

function SessionHead({
  title,
  subtitle,
  score,
  onBack,
}: {
  title: string;
  subtitle: string;
  score: string;
  onBack: () => void;
}): JSX.Element {
  const t = useT();
  return (
    <header className="s-head">
      <button type="button" className="iconbtn" aria-label={t('common.back')} onClick={onBack}>
        ←
      </button>
      <div className="s-title">
        <div>{title}</div>
        <div className="s-sub">{subtitle}</div>
      </div>
      <div className="s-score">{score}</div>
    </header>
  );
}

// ── 选项题 ────────────────────────────────────────────────────────────────────

function ChoiceAnswer({ session }: { session: Session }): JSX.Element {
  const q = session.question;
  if (q === null || q.kind !== 'choice') return <></>;
  return (
    <div className="opt-grid">
      {q.options.map((option, index) => {
        const isAnswer = option.id === q.answerId;
        const isPick = option.id === session.state.choicePick;
        const classes = ['opt'];
        if (session.state.answered) {
          if (isAnswer) classes.push('good');
          else if (isPick) classes.push('bad');
          else classes.push('dim');
        }
        return (
          <button
            key={option.id}
            type="button"
            className={classes.join(' ')}
            disabled={session.state.answered}
            onClick={() => session.choose(option.id)}
          >
            {index < 10 ? <span className="opt-kbd">{String((index + 1) % 10)}</span> : null}
            <span className="opt-label">{option.label}</span>
            {option.sub !== undefined ? <span className="opt-sub">{option.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceFeedback({ session }: { session: Session }): JSX.Element {
  const t = useT();
  const q = session.question;
  const result = session.state.result;
  if (q === null || q.kind !== 'choice' || result === null) return <></>;
  const correct = q.options.find((option) => option.id === q.answerId);
  const picked = q.options.find((option) => option.id === session.state.choicePick);
  return (
    <>
      <div className="fb-detail">
        {result.correct
          ? correct?.label
          : t('practice.itWas', { correct: correct?.label ?? '', yours: picked?.label ?? '' })}
      </div>
      {!result.correct && q.playOption !== null ? (
        <div className="fb-compare">
          <button
            type="button"
            className="btn small"
            onClick={() => {
              if (session.state.choicePick !== null) void q.playOption?.(session.state.choicePick);
            }}
          >
            ▶ {t('practice.yourPick')}
          </button>
          <button type="button" className="btn small" onClick={() => void q.playOption?.(q.answerId)}>
            ▶ {t('practice.answer')}
          </button>
        </div>
      ) : null}
      {q.mnemonic !== null ? <div className="fb-mnemonic">♪ {q.mnemonic}</div> : null}
    </>
  );
}

// ── 级数序列题 ────────────────────────────────────────────────────────────────

function SequenceAnswer({ session }: { session: Session }): JSX.Element {
  const t = useT();
  const q = session.question;
  if (q === null || q.kind !== 'sequence') return <></>;
  return (
    <>
      <div className="slots">
        {q.answerSeq.map((_, index) => {
          const value = session.state.seqPick[index] ?? null;
          const given = q.given[index] === true;
          const classes = ['slot'];
          if (given && value === null) classes.push('ghost');
          if (value !== null) classes.push('filled');
          if (session.state.answered) {
            classes.push(value === q.answerSeq[index] ? 'good' : 'bad');
          }
          return (
            <div key={index} className={classes.join(' ')}>
              {value ?? (given ? q.answerSeq[index] : '·')}
            </div>
          );
        })}
      </div>
      <div className="opt-grid numerals">
        {q.options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className="opt numeral"
            disabled={session.state.answered}
            onClick={() => session.fillSlot(option.id)}
          >
            {index < 10 ? <span className="opt-kbd">{String((index + 1) % 10)}</span> : null}
            <span className="opt-label">{option.label}</span>
          </button>
        ))}
      </div>
      <div className="seq-tools">
        <button type="button" className="btn small" onClick={session.undoSlot} disabled={session.state.answered}>
          ⌫ {t('practice.undo')}
        </button>
      </div>
    </>
  );
}

function SequenceFeedback({ session }: { session: Session }): JSX.Element {
  const t = useT();
  const q = session.question;
  if (q === null || q.kind !== 'sequence') return <></>;
  return (
    <>
      <div className="fb-detail">
        {session.state.result?.correct === true ? '' : `${t('practice.answer')}: `}
        {q.answerSeq.join(' – ')}
      </div>
      <div className="fb-compare">
        <button type="button" className="btn small" onClick={() => void q.playProgressionOnly()}>
          ▶ {t('practice.chordsOnly')}
        </button>
        <button type="button" className="btn small" onClick={() => void q.play()}>
          ▶ {t('practice.withCadence')}
        </button>
      </div>
    </>
  );
}

// ── 旋律听写 ──────────────────────────────────────────────────────────────────

function MelodyAnswer({
  session,
  pianoRef,
}: {
  session: Session;
  pianoRef: RefObject<PianoHandle | null>;
}): JSX.Element {
  const t = useT();
  const q = session.question;
  if (q === null || q.kind !== 'melody') return <></>;
  const slots = q.targetMidis.map((_, index) => {
    const value = session.state.melodyPick[index];
    const given = q.firstGiven && index === 0;
    const classes = ['slot', 'note'];
    if (value === undefined && given) classes.push('ghost');
    if (value !== undefined) classes.push('filled');
    if (session.state.answered) {
      classes.push(value === q.targetMidis[index] ? 'good' : 'bad');
    }
    return (
      <div key={index} className={classes.join(' ')}>
        {/* 第一个音是提示：显示音名，但用户仍要自己弹一遍（沿袭 earpath 的做法） */}
        {value === undefined
          ? given
            ? midiName(q.targetMidis[index] ?? 0)
            : '·'
          : midiName(value)}
      </div>
    );
  });

  return (
    <>
      <div className="slots">{slots}</div>
      <div className="piano-wrap">
        <Piano
          ref={pianoRef}
          lo={q.keyRange[0]}
          hi={q.keyRange[1]}
          tonic={q.tonicMidi}
          enabled={!session.state.answered}
          onKey={(midi) => {
            void pianoEngine.playEvents([{ midi, at: 0, dur: 0.7 }]);
            session.playMelodyNote(midi);
          }}
        />
      </div>
      <div className="seq-tools">
        <button
          type="button"
          className="btn small"
          onClick={session.undoMelodyNote}
          disabled={session.state.answered}
        >
          ⌫ {t('practice.undo')}
        </button>
      </div>
    </>
  );
}

function MelodyFeedback({
  session,
  pianoRef,
}: {
  session: Session;
  pianoRef: RefObject<PianoHandle | null>;
}): JSX.Element {
  const t = useT();
  const q = session.question;
  if (q === null || q.kind !== 'melody') return <></>;
  if (session.state.result?.correct === true) {
    return <div className="fb-detail">{q.targetMidis.map(midiName).join(' ')}</div>;
  }
  return (
    <>
      <div className="fb-detail">
        {t('practice.answer')}: {q.targetMidis.map(midiName).join(' ')}
      </div>
      <div className="fb-compare">
        <button type="button" className="btn small" onClick={() => void q.playMelodyOnly()}>
          ▶ {t('practice.melody')}
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => {
            const tempo = Progress.getState().settings.melodyTempo;
            pianoRef.current?.clear();
            void q.playMelodyOnly();
            q.targetMidis.forEach((midi, index) => {
              window.setTimeout(
                () => pianoRef.current?.flash(midi, 'hl-good', tempo * 880),
                index * tempo * 1000,
              );
            });
          }}
        >
          👆 {t('practice.showOnPiano')}
        </button>
      </div>
    </>
  );
}

// ── 排序题（yuegan 的核心练习） ───────────────────────────────────────────────

function RankAnswer({
  session,
  question,
}: {
  session: Session;
  question: RankQuestion;
}): JSX.Element {
  const t = useT();
  const judgment = session.state.judgment;
  const noteCount = question.noteCount;
  // 档位梯从上到下：数字大的（更高的音）在上面，和听感方向一致。
  const ranks = Array.from({ length: noteCount }, (_, index) => noteCount - index);

  return (
    <>
      <div className="rank-board">
        {Array.from({ length: noteCount }, (_, noteIndex) => {
          const selected = session.state.rankDraft[noteIndex] ?? null;
          const taken = session.takenRanks(noteIndex);
          const detail = judgment?.details[noteIndex];
          const classes = ['rank-col'];
          if (detail !== undefined) classes.push(detail.isCorrect ? 'is-correct' : 'is-wrong');
          return (
            <div key={noteIndex} className={classes.join(' ')}>
              <span className="rank-col-label">{t('practice.noteIndex', { n: noteIndex + 1 })}</span>
              <div className="rank-track">
                {ranks.map((rank) => {
                  const cellClasses = ['rank-cell'];
                  if (selected === rank) cellClasses.push('is-selected');
                  else if (taken.has(rank)) cellClasses.push('is-taken');
                  if (detail !== undefined) {
                    if (detail.correctRank === rank) cellClasses.push('is-correct');
                    else if (detail.answeredRank === rank) cellClasses.push('is-wrong');
                  }
                  return (
                    <button
                      key={rank}
                      type="button"
                      className={cellClasses.join(' ')}
                      disabled={session.state.answered || taken.has(rank)}
                      onClick={() => session.assign(noteIndex, rank)}
                    >
                      {rank}
                    </button>
                  );
                })}
              </div>
              <span className={selected === null ? 'rank-value is-empty' : 'rank-value'}>
                {selected === null ? t('practice.noPick') : t('practice.rankValue', { n: selected })}
              </span>
            </div>
          );
        })}
      </div>

      {/* 反馈阶段：每个音一行铺满宽度——挤在窄列里会把「与上一个音相差 N 个半音」折成三行 */}
      {judgment === null ? null : (
        <div className="rank-feedback-list">
          {question.exercise.pitches.map((pitch, noteIndex) => {
            const detail = judgment.details[noteIndex];
            if (detail === undefined) {
              return null;
            }
            const semitones =
              noteIndex === 0
                ? null
                : intervalBetween(
                    question.exercise.pitches[noteIndex - 1] as number,
                    pitch,
                  ).semitones;
            return (
              <div key={noteIndex} className="rank-feedback-row">
                <span className="rank-note">{t('practice.noteIndex', { n: noteIndex + 1 })}</span>
                <span className={detail.isCorrect ? 'tag tag-right' : 'tag tag-wrong'}>
                  {detail.isCorrect ? t('practice.rankRight') : t('practice.rankWrong')}
                </span>
                <span className="muted">
                  {t('practice.yours')}{' '}
                  <span className="nowrap">{t('practice.rankValue', { n: detail.answeredRank })}</span>
                </span>
                <span className="muted">
                  {t('practice.correctRank')}{' '}
                  <span className="nowrap">{t('practice.rankValue', { n: detail.correctRank })}</span>
                </span>
                <span className="rank-truth">
                  {t('practice.truthPitch')} <strong>{question.noteNames[noteIndex]}</strong>
                </span>
                {semitones === null ? null : (
                  <span className="muted">{t('practice.fromPrevious', { n: semitones })}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!session.state.answered ? (
        <button
          type="button"
          className="btn primary"
          disabled={!session.canSubmitRank}
          onClick={session.submitRank}
        >
          {session.canSubmitRank ? t('practice.submit') : t('practice.fillAll')}
        </button>
      ) : null}
    </>
  );
}

/** 排序题的总体反馈：排对了几个 + 真实的高低顺序（含每个音的真实音高）。 */
function RankFeedback({
  session,
  question,
}: {
  session: Session;
  question: RankQuestion;
}): JSX.Element {
  const t = useT();
  const judgment = session.state.judgment;
  const truth = question.exercise.pitches
    .map((pitch, index) => ({ pitch, name: question.noteNames[index] ?? '' }))
    .sort((a, b) => a.pitch - b.pitch);

  return (
    <>
      {judgment === null ? null : (
        <div className="fb-detail">
          {t('practice.rankMatched', { matched: judgment.matchedCount, total: judgment.noteCount })}
        </div>
      )}
      <div className="fb-detail">
        {t('practice.truthOrder')}: {truth.map((item) => item.name).join(' → ')}
        {` · ${t('practice.span', { n: question.spanSemitones })}`}
      </div>
    </>
  );
}


// ── 结算浮层 ──────────────────────────────────────────────────────────────────

function LevelOverlay({
  session,
  moduleId,
  levelIdx,
}: {
  session: Session;
  moduleId: string;
  levelIdx: number;
}): JSX.Element {
  const t = useT();
  const mod = moduleById(moduleId);
  const level = mod?.levels[levelIdx];
  const nextLevel = mod?.levels[levelIdx + 1];
  return (
    <div className="overlay">
      <div className="celebrate">
        <div className="celebrate-emoji">🎉</div>
        <div className="celebrate-title">{t('practice.levelComplete')}</div>
        <div className="celebrate-sub">
          {mod === undefined ? '' : t(mod.titleKey)} · {level === undefined ? '' : t(level.nameKey)}
        </div>
        <div className="celebrate-actions">
          {nextLevel !== undefined ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => go(`#/practice/${moduleId}/${levelIdx + 1}`)}
            >
              {t('practice.nextLevel')}: {t(nextLevel.nameKey)} →
            </button>
          ) : null}
          <button type="button" className="btn" onClick={session.keepPracticing}>
            {t('practice.keepPracticing')}
          </button>
          <button type="button" className="btn ghost" onClick={() => go('#/')}>
            {t('common.home')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DailyOverlay({ session, total }: { session: Session; total: number }): JSX.Element {
  const t = useT();
  const correct = session.state.correctCount;
  const pct = Math.round((correct / total) * 100);
  return (
    <div className="overlay">
      <div className="celebrate">
        <div className="celebrate-emoji">{pct >= 80 ? '🔥' : pct >= 50 ? '💪' : '🌱'}</div>
        <div className="celebrate-title">{t('practice.workoutComplete')}</div>
        <div className="celebrate-sub">{t('practice.workoutScore', { correct, total, pct })}</div>
        <div className="celebrate-actions">
          <button type="button" className="btn primary" onClick={() => go('#/')}>
            {t('practice.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

