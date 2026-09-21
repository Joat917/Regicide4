/**
 * 卡牌值对象
 *
 * 每张牌是不可变对象，字段：
 *   uid      唯一标识（同一局内不重复，视图用它做 DOM 复用）
 *   suit     'C' | 'D' | 'H' | 'S' | null（小丑）
 *   rank     'A' | '2'..'10' | 'J' | 'Q' | 'K' | 'JOKER'
 *   value    攻击 / 挡伤害时的点数
 *   isJoker / isAce / isRoyal / isNumber
 */

import { JOKER_RANK, NUMBER_RANKS, RANK_VALUE, ROYAL_RANKS } from './constants.js';

function make(uid, suit, rank) {
  return Object.freeze({
    uid,
    suit,
    rank,
    value: RANK_VALUE[rank],
    isJoker: rank === JOKER_RANK,
    isAce: rank === 'A',
    isRoyal: ROYAL_RANKS.includes(rank),
    isNumber: NUMBER_RANKS.includes(rank),
  });
}

/** 建一张普通牌，例如 createCard('C', 'A') */
export function createCard(suit, rank) {
  return make(`${suit}${rank}`, suit, rank);
}

/** 建一张小丑（单人模式里放在一旁，不进牌堆） */
export function createJoker(index = 1) {
  return make(`JOKER-${index}`, null, JOKER_RANK);
}

/** 两张小丑 */
export function createJokers() {
  return [createJoker(1), createJoker(2)];
}

/** 同一张牌？按 uid 比较即可 */
export function sameCard(a, b) {
  return Boolean(a) && Boolean(b) && a.uid === b.uid;
}
