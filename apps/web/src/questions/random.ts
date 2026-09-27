/**
 * 出题用的随机工具（应用层）。
 *
 * 这几个函数服务的是「怎么把一道题摆出来」——挑哪个根音、选项顺序怎么放——
 * 属于产品侧的出题策略。规则本身（音高怎么取、答案怎么判）在 `@yuegan/core` 里，
 * 那边一律通过 `RandomSource` 端口取随机数，不用 `Math.random`。
 */

/** 闭区间随机整数。 */
export function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function choice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

/** 按权重取一个；weights 与 items 等长。 */
export function weightedChoice<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index] as number;
    if (roll <= 0) {
      return items[index] as T;
    }
  }
  return items[items.length - 1] as T;
}
