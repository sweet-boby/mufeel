/**
 * 随机源端口：领域逻辑里不直接调用 Math.random，
 * 而是通过这个接口拿随机数，测试时注入确定性的实现就能复现任何一局。
 */

export interface RandomSource {
  /** 返回 [0, 1) 之间的浮点数。 */
  next(): number;
}

export function createMathRandomSource(): RandomSource {
  return { next: () => Math.random() };
}

/** 从数组里等概率取一个元素。 */
export function pickOne<T>(items: readonly T[], random: RandomSource): T {
  if (items.length === 0) {
    throw new Error('无法从空数组中取元素');
  }
  const index = Math.floor(random.next() * items.length);
  return items[Math.min(index, items.length - 1)] as T;
}

/**
 * 按权重取一个元素；weights 与 items 等长。
 *
 * 权重之和为 0 或出现负权重时抛错：静默退化成一个固定结果会让「随机但必须满足性质」
 * 的出题逻辑在测试里看起来仍然通过，实际却永远出同一道题。
 */
export function weightedPick<T>(
  items: readonly T[],
  weights: readonly number[],
  random: RandomSource,
): T {
  if (items.length === 0) {
    throw new Error('无法从空数组中取元素');
  }
  if (items.length !== weights.length) {
    throw new Error(`权重数量与元素数量不一致：${items.length} vs ${weights.length}`);
  }
  const total = weights.reduce((sum, weight) => {
    if (weight < 0) {
      throw new Error(`权重不能为负：${weight}`);
    }
    return sum + weight;
  }, 0);
  if (total <= 0) {
    throw new Error('权重之和必须大于 0');
  }
  let roll = random.next() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index] as number;
    if (roll <= 0) {
      return items[index] as T;
    }
  }
  return items[items.length - 1] as T;
}

/** Fisher–Yates 洗牌，返回新数组（不改动入参）。 */
export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}
