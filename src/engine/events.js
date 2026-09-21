/**
 * 事件构造器
 *
 * 引擎只产出这些纯数据事件，不认识界面；界面（src/anim、src/view）负责把它们
 * 翻译成动画和人话。事件类型与 CLI 版 regicide/engine.py 同名同义。
 */

import { EVENT } from './constants.js';

export { EVENT };

export const events = {
  play: (cards) => ({ kind: EVENT.PLAY, cards }),
  suitHeart: (amount, suit = 'H') => ({ kind: EVENT.SUIT_HEART, suit, amount }),
  suitDiamond: (amount, suit = 'D') => ({ kind: EVENT.SUIT_DIAMOND, suit, amount }),
  suitSpade: (amount, suit = 'S') => ({ kind: EVENT.SUIT_SPADE, suit, amount }),
  suitClub: (damage, suit = 'C') => ({ kind: EVENT.SUIT_CLUB, suit, amount: damage }),
  suitBlocked: (suit) => ({ kind: EVENT.SUIT_BLOCKED, suit }),
  damage: (amount, card) => ({ kind: EVENT.DAMAGE, amount, card }),
  defeat: (card, exact) => ({ kind: exact ? EVENT.DEFEAT_EXACT : EVENT.DEFEAT, card }),
  newEnemy: (card) => ({ kind: EVENT.NEW_ENEMY, card }),
  counterattack: (amount, card) => ({ kind: EVENT.COUNTERATTACK, amount, card }),
  damagePaid: (cards, amount) => ({ kind: EVENT.DAMAGE_PAID, cards, amount }),
  jesterRefill: (cards, drawn) => ({ kind: EVENT.JESTER_REFILL, cards, amount: drawn }),
  win: () => ({ kind: EVENT.WIN }),
  lose: () => ({ kind: EVENT.LOSE }),
};
