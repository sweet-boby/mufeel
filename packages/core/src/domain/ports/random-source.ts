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
