/**
 * @yuegan/core —— 平台无关的领域核心。
 *
 * 这个包不许出现 DOM、Web Audio、React 或任何浏览器 API：
 * 它必须能原样跑在 Node（测试）、浏览器（Web 端）和以后的安卓端。
 * 平台能力一律通过 domain/ports 里的接口注入。
 */

export * from './domain/value-objects/pitch';
export * from './domain/value-objects/note-name';
export * from './domain/value-objects/interval';
export * from './domain/value-objects/rank';
export * from './domain/value-objects/sample-map';

// 音乐内容：有哪些音程/和弦/音阶/音级/级数。只存 id 与半音结构，
// 不含面向用户的名字（那是平台侧的 i18n），也不含任何平台能力。
export * from './domain/content/intervals';
export * from './domain/content/chords';
export * from './domain/content/scales';
export * from './domain/content/degrees';
export * from './domain/content/numerals';

export * from './domain/entities/drill-spec';
export * from './domain/entities/exercise';
export * from './domain/entities/answer';
export * from './domain/entities/judgment';
export * from './domain/entities/drill-session';

export * from './domain/services/exercise-generator';
export * from './domain/services/judge';
export * from './domain/services/voicing';
export * from './domain/services/melody';

export * from './domain/ports/audio-player';
export * from './domain/ports/drill-record-repository';
export * from './domain/ports/random-source';

export * from './domain/config';

export * from './application/emitter';
export * from './application/drill-runner';
export * from './application/view-model';
