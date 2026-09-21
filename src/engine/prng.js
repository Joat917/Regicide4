/**
 * 可播种随机数（mulberry32）+ 洗牌
 *
 * 引擎里一律用这里的 rng，**不用 Math.random()**：
 * 同一 seed 的牌局完全可复现，测试才能写断言。
 */

/** @param {number} seed @returns {() => number} 返回 [0,1) 的随机数 */
export function createRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 原地洗牌（Fisher–Yates），返回同一个数组 */
export function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
