/**
 * 合法操作生成 + 效果预览（纯函数，不认识"局面"，只认手牌与敌人）
 *
 * 出牌规则（见 rules/Regicide-规则详解.md §4 步骤 1）：
 *   1. 出 1 张牌（含归顺的 J/Q/K，价值 10/15/20）
 *   2. 出一组点数相同的数字牌（A 除外），总点数 ≤ 10
 *   3. 出 1 张 A，可单独出（1 点），也可与另 1 张牌搭配（+1 点，双花色能力）
 *   4. 投降：本实现是单人模式，规则不允许投降，所以不生成
 */

import { COMBO_MAX_SUM } from './constants.js';

/** 该花色能力此刻是否有效（王族免疫自身花色） */
export function isPowerActive(enemy, immunityCancelled, suit) {
  if (!enemy || !suit) return false;
  if (enemy.suit === suit && !immunityCancelled) return false;
  return true;
}

/** 预测一次出牌的效果，返回 Move 的效果字段 */
export function previewPlay(cards, enemy, immunityCancelled = false) {
  const suits = new Set();
  for (const card of cards) if (card.suit) suits.add(card.suit);

  // 关键：每个花色能力用的 X 都是**本次出牌的总点数**（含 A 的 +1），
  // 而不是"该花色牌的点数之和"；同一花色只结算一次。
  // 依据：官方示例「8♦ + A♣ → 抽 9 张、造成 18 伤害」。
  const value = cards.reduce((sum, card) => sum + card.value, 0);
  const doubled = suits.has('C') && isPowerActive(enemy, immunityCancelled, 'C');
  return {
    value,
    damage: doubled ? value * 2 : value,
    doubled,
    hearts: suits.has('H') && isPowerActive(enemy, immunityCancelled, 'H') ? value : 0,
    diamonds: suits.has('D') && isPowerActive(enemy, immunityCancelled, 'D') ? value : 0,
    spades: suits.has('S') && isPowerActive(enemy, immunityCancelled, 'S') ? value : 0,
  };
}

/**
 * 诊断一组手牌为什么不能出（合法则返回 null）。
 *
 * 只做规则判断并返回**结构化的原因**，文案由界面层翻译——
 * 这样提示才能针对玩家实际选的牌，而不是念一遍规则书。
 *
 * @returns {null | {code: 'empty'|'mixed'|'sum'|'ace'|'royalOnly'|'joker', sum?: number, limit?: number}}
 */
export function explainPlay(cards) {
  if (!cards || cards.length === 0) return { code: 'empty' };
  if (cards.some((card) => card.isJoker)) return { code: 'joker' };
  if (cards.length === 1) return null;

  const sameRank = cards.every((card) => card.rank === cards[0].rank);
  if (sameRank) {
    // 归顺的 J/Q/K 只能单出
    if (!cards[0].isNumber) return { code: 'royalOnly' };
    const sum = cards.reduce((total, card) => total + card.value, 0);
    if (sum > COMBO_MAX_SUM) return { code: 'sum', sum, limit: COMBO_MAX_SUM };
    return null;
  }

  if (cards.length === 2 && cards.some((card) => card.isAce)) return null;
  if (cards.some((card) => card.isAce)) return { code: 'ace' };
  return { code: 'mixed' };
}

/** 这组牌本身是否符合出牌规则（不看阶段、不看牌库） */
export function isLegalPlay(cards) {
  return explainPlay(cards) === null;
}

function subsets(indices, minSize) {
  const out = [];
  const n = indices.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset = [];
    for (let bit = 0; bit < n; bit++) if (mask & (1 << bit)) subset.push(indices[bit]);
    if (subset.length >= minSize) out.push(subset);
  }
  return out;
}

function makeMove(cardIds, hand, enemy, immunityCancelled) {
  const cards = cardIds.map((i) => hand[i]);
  return Object.freeze({
    kind: 'play',
    cardIds: Object.freeze([...cardIds].sort((a, b) => a - b)),
    ...previewPlay(cards, enemy, immunityCancelled),
  });
}

/** 枚举当前手牌所有合法的「出牌」操作 */
export function generateMoves(hand, enemy, immunityCancelled = false) {
  const moves = [];

  // 1) 单张
  hand.forEach((card, i) => {
    if (!card.isJoker) moves.push(makeMove([i], hand, enemy, immunityCancelled));
  });

  // 2) 同点数组合（仅数字牌，且总和 ≤ 10）
  const byRank = new Map();
  hand.forEach((card, i) => {
    if (!card.isNumber) return;
    if (!byRank.has(card.rank)) byRank.set(card.rank, []);
    byRank.get(card.rank).push(i);
  });
  for (const group of byRank.values()) {
    for (const subset of subsets(group, 2)) {
      if (subset.reduce((sum, i) => sum + hand[i].value, 0) <= COMBO_MAX_SUM) {
        moves.push(makeMove(subset, hand, enemy, immunityCancelled));
      }
    }
  }

  // 3) A + 另一张牌（A 与 A 也可以，总值 = 1 + 1 = 2）
  const aces = [];
  const others = [];
  hand.forEach((card, i) => {
    if (card.isJoker) return;
    if (card.isAce) aces.push(i);
    else others.push(i);
  });
  const seen = new Set();
  for (const ace of aces) {
    for (const other of [...others, ...aces.filter((i) => i !== ace)]) {
      const key = [ace, other].sort((a, b) => a - b).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push(makeMove([ace, other], hand, enemy, immunityCancelled));
    }
  }

  return moves.sort(
    (a, b) => a.damage - b.damage || a.value - b.value || a.cardIds[0] - b.cardIds[0],
  );
}

/** 在合法操作里找出"恰好是这组手牌下标"的那个（界面确认出牌时用） */
export function findMoveForCards(moves, cardIds) {
  const key = [...cardIds].sort((a, b) => a - b).join(',');
  return moves.find((move) => move.kind === 'play' && move.cardIds.join(',') === key) ?? null;
}

/** 小丑能力（单人模式：不是出牌，而是"弃整手牌补满 8 张"） */
export function jesterPowerMove() {
  return Object.freeze({
    kind: 'jester_power',
    cardIds: Object.freeze([]),
    value: 0,
    damage: 0,
    doubled: false,
    hearts: 0,
    diamonds: 0,
    spades: 0,
  });
}
