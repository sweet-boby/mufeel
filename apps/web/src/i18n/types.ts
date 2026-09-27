/**
 * i18n 的类型约定。
 *
 * 字典是**扁平**的 key → 文案表：key 用点号分段，例如 `module.pitch.title`。
 * 扁平而不是嵌套对象，是为了让「缺哪条文案」在编译期和测试里都好查——
 * `zh` 与 `en` 是同一个 `Dict`，少一条就报错。
 */

export type Lang = 'zh' | 'en';

/** 一份完整字典。`Record<string, string>` 不能保证两条语言键一致，见 i18n.test.ts。 */
export type Dict = Record<string, string>;

/** 插值参数，`{name}` 形式占位。 */
export type Params = Record<string, string | number>;

/** 翻译函数：拿不到 key 时依次回落到英文、key 本身（便于发现漏翻）。 */
export type TFunc = (key: string, params?: Params) => string;
