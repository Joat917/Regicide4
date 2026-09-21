/**
 * 规则常量（纯数据，无逻辑、无副作用）
 *
 * 数值来源：rules/Regicide-规则详解.md
 * 花色顺序与 regicideHQ/js/content.js 的 PowerList 一致：♣ ♦ ♥ ♠
 */

export const SUITS = Object.freeze(['C', 'D', 'H', 'S']); // ♣ ♦ ♥ ♠
export const SUIT_INDEX = Object.freeze({ C: 0, D: 1, H: 2, S: 3 });

export const NUMBER_RANKS = Object.freeze(['2', '3', '4', '5', '6', '7', '8', '9', '10']);
export const ROYAL_RANKS = Object.freeze(['J', 'Q', 'K']);
export const JOKER_RANK = 'JOKER';

/** 作为攻击牌 / 挡伤害牌时的点数 */
export const RANK_VALUE = Object.freeze({
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 15,
  K: 20,
  [JOKER_RANK]: 0,
});

/** 王族数值：J 10/20、Q 15/30、K 20/40 */
export const ROYAL_ATTACK = Object.freeze({ J: 10, Q: 15, K: 20 });
export const ROYAL_HEALTH = Object.freeze({ J: 20, Q: 30, K: 40 });

/** 单人模式参数 */
export const HAND_LIMIT = 8;      // 手牌上限
export const JESTER_POWERS = 2;   // 小丑能力可用次数
export const COMBO_MAX_SUM = 10;  // 同点数组合的总点数上限
export const MAX_REDEAL = 100;    // 起手无 ♦ 时重新发牌的次数上限

/** 阶段 */
export const PHASE = Object.freeze({
  PLAY: 'play',     // 步骤 1~3：出牌、结算花色、造成伤害
  DAMAGE: 'damage', // 步骤 4：承受王族反击
  OVER: 'over',
});

/** 事件类型（与 CLI 版 regicide/engine.py 同名同义） */
export const EVENT = Object.freeze({
  PLAY: 'play',
  SUIT_HEART: 'suit_heart',
  SUIT_DIAMOND: 'suit_diamond',
  SUIT_SPADE: 'suit_spade',
  SUIT_CLUB: 'suit_club',
  SUIT_BLOCKED: 'suit_blocked',
  DAMAGE: 'damage',
  DEFEAT: 'defeat',
  DEFEAT_EXACT: 'defeat_exact',
  NEW_ENEMY: 'new_enemy',
  COUNTERATTACK: 'counterattack',
  DAMAGE_PAID: 'damage_paid',
  JESTER_REFILL: 'jester_refill',
  WIN: 'win',
  LOSE: 'lose',
});
