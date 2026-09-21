/**
 * 单人模式局面状态机（纯计算：无 DOM、无定时器、无网络、无 Math.random）
 *
 * 对外只暴露：
 *   state()          只读快照（冻结），界面照着它渲染
 *   legalMoves()     当前所有合法操作（含小丑能力）
 *   playMove(move)   执行操作 → 事件数组
 *   payDamage(ids)   步骤 4：弃牌挡伤害 → 事件数组
 *   useJester()      小丑能力 → 事件数组
 *   suggestPayment() 参考弃牌方案（界面用）
 *   inspect()        只读的牌堆内容（测试/调试用）
 *
 * 规则细节与取舍见 web/PLAN.md 与 rules/Regicide-规则详解.md。
 */

import {
  HAND_LIMIT,
  JESTER_POWERS,
  MAX_REDEAL,
  PHASE,
  ROYAL_ATTACK,
  ROYAL_HEALTH,
} from './constants.js';
import { createJokers } from './card.js';
import { Deck, createCastleDeck, createTavernDeck } from './decks.js';
import { events } from './events.js';
import { generateMoves, isLegalPlay, isPowerActive, jesterPowerMove } from './moves.js';
import { createRng } from './prng.js';

/**
 * @param {object} [options]
 * @param {number} [options.seed]     随机种子（同一 seed 完全可复现）
 * @param {Array}  [options.tavern]   指定酒馆牌堆（数组末尾 = 牌顶），测试用
 * @param {Array}  [options.castle]   指定城堡牌堆（数组末尾 = 牌顶），测试用
 * @param {boolean}[options.redeal]   起手无 ♦ 时是否重新发牌（测试用 false 更可控）
 */
export function createSoloGame(options = {}) {
  const { seed = 1, tavern = null, castle = null, redeal = true } = options;

  const rng = createRng(seed);
  const game = {
    rng,
    tavern: tavern ? new Deck(tavern) : createTavernDeck(rng),
    castle: castle ? new Deck(castle) : createCastleDeck(rng),
    discard: new Deck([]),
    jokers: createJokers(),
    hand: [],
    table: [],
    jestersLeft: JESTER_POWERS,
    phase: PHASE.PLAY,
    outcome: null,
    redeals: 0,
    enemy: null,
    enemyHealth: 0,
    attackReduction: 0,
    immunityCancelled: false,
  };

  dealOpeningHand(game, redeal);
  revealEnemy(game);

  return {
    state: () => snapshot(game),
    legalMoves: () => legalMoves(game),
    playMove: (move) => playMove(game, move),
    payDamage: (ids) => payDamage(game, ids),
    validatePayment: (ids) => validatePayment(game, ids),
    suggestPayment: () => suggestPayment(game),
    canUseJester: () => canUseJester(game),
    useJester: () => useJester(game),
    damageOwed: () => damageOwed(game),
    maxDamagePayable: () => handTotal(game),
    inspect: () => inspect(game),
  };
}

// ---------------------------------------------------------------- 派生数值

function handTotal(game) {
  return game.hand.reduce((sum, card) => sum + card.value, 0);
}

function damageOwed(game) {
  if (!game.enemy) return 0;
  return Math.max(0, ROYAL_ATTACK[game.enemy.rank] - game.attackReduction);
}

function immunityActive(game) {
  return Boolean(game.enemy) && !game.immunityCancelled;
}

function victoryTier(game) {
  if (game.outcome !== 'win') return null;
  const used = JESTER_POWERS - game.jestersLeft;
  if (used === 0) return 'gold';
  if (used === 1) return 'silver';
  return 'bronze';
}

// ---------------------------------------------------------------- 快照

function snapshot(game) {
  const enemy = game.enemy;
  return Object.freeze({
    hand: Object.freeze([...game.hand]),
    table: Object.freeze([...game.table]),
    enemy,
    enemyHealth: game.enemyHealth,
    enemyMaxHealth: enemy ? ROYAL_HEALTH[enemy.rank] : 0,
    enemyAttack: enemy ? ROYAL_ATTACK[enemy.rank] : 0,
    attackReduction: game.attackReduction,
    damageOwed: damageOwed(game),
    immunityActive: immunityActive(game),
    tavernCount: game.tavern.count,
    discardCount: game.discard.count,
    castleCount: game.castle.count,
    jestersLeft: game.jestersLeft,
    handTotal: handTotal(game),
    phase: game.phase,
    outcome: game.outcome,
    victoryTier: victoryTier(game),
    redeals: game.redeals,
  });
}

/** 只读的牌堆内容（测试与调试用） */
function inspect(game) {
  return Object.freeze({
    tavern: Object.freeze(game.tavern.toArray()),
    discard: Object.freeze(game.discard.toArray()),
    castle: Object.freeze(game.castle.toArray()),
    jokers: Object.freeze([...game.jokers]),
  });
}

// ---------------------------------------------------------------- 开局

function drawTo(game, count) {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (game.hand.length >= HAND_LIMIT || game.tavern.count === 0) break;
    game.hand.push(game.tavern.draw());
    drawn += 1;
  }
  return drawn;
}

function dealOpeningHand(game, allowRedeal) {
  const attempts = allowRedeal ? MAX_REDEAL : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    game.hand = [];
    drawTo(game, HAND_LIMIT);
    if (game.hand.some((card) => card.suit === 'D')) return;
    if (!allowRedeal) return;
    game.tavern.addToBottom(game.hand);
    game.hand = [];
    game.tavern.shuffle(game.rng);
    game.redeals += 1;
  }
  if (game.hand.length === 0) drawTo(game, HAND_LIMIT);
}

function revealEnemy(game) {
  const card = game.castle.draw();
  game.enemy = card;
  game.enemyHealth = card ? ROYAL_HEALTH[card.rank] : 0;
  game.attackReduction = 0;
  game.immunityCancelled = false;
}

// ---------------------------------------------------------------- 步骤 1 出牌

function legalMoves(game) {
  if (game.phase !== PHASE.PLAY || game.outcome) return Object.freeze([]);
  const moves = generateMoves(game.hand, game.enemy, game.immunityCancelled);
  if (game.jestersLeft > 0) moves.push(jesterPowerMove());
  return Object.freeze(moves);
}

function playMove(game, move) {
  if (game.phase !== PHASE.PLAY || game.outcome) throw new Error('当前阶段不能出牌');
  if (move.kind === 'jester_power') return useJester(game);
  if (move.kind !== 'play') throw new Error(`未知操作类型：${move.kind}`);

  const ids = [...move.cardIds].sort((a, b) => a - b);
  const cards = ids.map((i) => game.hand[i]);
  if (!isLegalPlay(cards)) throw new Error('这组牌不符合出牌规则');

  const out = [];
  for (const i of [...ids].sort((a, b) => b - a)) game.hand.splice(i, 1);
  game.table.push(...cards);
  out.push(events.play(cards));

  const suits = new Set();
  for (const card of cards) if (card.suit) suits.add(card.suit);
  const playValue = cards.reduce((sum, card) => sum + card.value, 0);

  // 步骤 2：花色能力。顺序固定为 ♥ → ♦ → ♠ → ♣（♣ 只影响伤害）
  // X = 本次出牌的总点数（官方示例：8♦ + A♣ → 抽 9 张、造成 18 伤害）
  for (const suit of ['H', 'D']) {
    if (!suits.has(suit)) continue;
    if (!isPowerActive(game.enemy, game.immunityCancelled, suit)) {
      out.push(events.suitBlocked(suit));
      continue;
    }
    if (suit === 'H') out.push(events.suitHeart(recycle(game, playValue)));
    else out.push(events.suitDiamond(drawTo(game, playValue)));
  }

  if (suits.has('S')) {
    if (isPowerActive(game.enemy, game.immunityCancelled, 'S')) {
      game.attackReduction += playValue;
      out.push(events.suitSpade(playValue));
    } else {
      out.push(events.suitBlocked('S'));
    }
  }

  let damage = playValue;
  if (suits.has('C')) {
    if (isPowerActive(game.enemy, game.immunityCancelled, 'C')) {
      damage = playValue * 2;
      out.push(events.suitClub(damage));
    } else {
      out.push(events.suitBlocked('C'));
    }
  }

  // 步骤 3：造成伤害
  game.enemyHealth -= damage;
  out.push(events.damage(damage, game.enemy));

  if (game.enemyHealth <= 0) {
    resolveDefeat(game, out);
  } else {
    // 步骤 4：王族反击
    const owed = damageOwed(game);
    out.push(events.counterattack(owed, game.enemy));
    if (owed > 0) {
      game.phase = PHASE.DAMAGE;
    } else {
      // 黑桃已经把攻击削到 0：不需要弃牌，直接进入下一个回合
      out.push(events.damagePaid([], 0));
      game.phase = PHASE.PLAY;
    }
  }

  checkForcedEnd(game, out);
  return out;
}

function resolveDefeat(game, out) {
  const royal = game.enemy;
  const exact = game.enemyHealth === 0;
  if (exact) game.tavern.addToTop(royal); // 精确击杀 → 面朝下放到酒馆牌堆顶
  else game.discard.addToTop(royal);
  out.push(events.defeat(royal, exact));

  game.discard.addToTop(game.table); // 桌面牌此刻才进弃牌堆
  game.table = [];
  game.attackReduction = 0;
  game.immunityCancelled = false;
  game.enemy = null;

  if (game.castle.count > 0) {
    revealEnemy(game);
    out.push(events.newEnemy(game.enemy));
    game.phase = PHASE.PLAY; // 同一名玩家立刻继续
  } else {
    game.outcome = 'win';
    game.phase = PHASE.OVER;
    out.push(events.win());
  }
}

/** ♥ 红桃：洗混弃牌堆，随机取 count 张放回酒馆牌堆底部 */
function recycle(game, count) {
  if (count <= 0 || game.discard.count === 0) return 0;
  game.discard.shuffle(game.rng);
  const moved = Math.min(count, game.discard.count);
  const cards = [];
  for (let i = 0; i < moved; i++) cards.push(game.discard.draw());
  game.tavern.addToBottom(cards);
  return moved;
}

// ---------------------------------------------------------------- 步骤 4 承受反击

function validatePayment(game, ids) {
  if (game.phase !== PHASE.DAMAGE || game.outcome) {
    return { ok: false, reason: '当前阶段不需要弃牌挡伤害' };
  }
  const unique = [...new Set(ids)];
  const invalid = unique.some(
    (i) => !Number.isInteger(i) || i < 0 || i >= game.hand.length,
  );
  if (invalid) return { ok: false, reason: '手牌下标越界' };

  const total = unique.reduce((sum, i) => sum + game.hand[i].value, 0);
  const owed = damageOwed(game);
  if (total < owed) {
    return { ok: false, reason: `这些牌合计 ${total} 点，不足以挡下 ${owed} 点伤害` };
  }
  return { ok: true, reason: '', total };
}

function payDamage(game, ids) {
  const check = validatePayment(game, ids);
  if (!check.ok) throw new Error(check.reason);

  const unique = [...new Set(ids)].sort((a, b) => b - a);
  const cards = unique.map((i) => game.hand[i]);
  for (const i of unique) game.hand.splice(i, 1);
  game.discard.addToTop(cards);

  const out = [events.damagePaid(cards, cards.reduce((sum, c) => sum + c.value, 0))];
  game.phase = PHASE.PLAY; // 单人模式：还是你，开始新回合
  checkForcedEnd(game, out);
  return out;
}

/** 参考弃牌方案：按点数从大到小凑够伤害；凑不够返回 null */
function suggestPayment(game) {
  const owed = damageOwed(game);
  const order = game.hand
    .map((_, i) => i)
    .sort((a, b) => game.hand[b].value - game.hand[a].value);
  const chosen = [];
  let total = 0;
  for (const i of order) {
    if (total >= owed) break;
    chosen.push(i);
    total += game.hand[i].value;
  }
  if (total < owed) return null;
  return chosen.sort((a, b) => a - b);
}

// ---------------------------------------------------------------- 小丑能力

function canUseJester(game) {
  const phaseOk = game.phase === PHASE.PLAY || game.phase === PHASE.DAMAGE;
  return game.jestersLeft > 0 && phaseOk && !game.outcome;
}

function useJester(game) {
  if (!canUseJester(game)) throw new Error('现在不能使用小丑能力');

  const discarded = [...game.hand];
  game.discard.addToTop(discarded);
  game.hand = [];
  game.jestersLeft -= 1;
  const drawn = drawTo(game, HAND_LIMIT); // 不算"抽牌"，所以不受 ♦ 免疫影响

  const out = [events.jesterRefill(discarded, drawn)];
  checkForcedEnd(game, out);
  return out;
}

// ---------------------------------------------------------------- 判负兜底

function checkForcedEnd(game, out) {
  if (game.outcome) return;
  if (game.phase === PHASE.PLAY && game.hand.length === 0 && game.jestersLeft === 0) {
    lose(game, out);
  } else if (game.phase === PHASE.DAMAGE && handTotal(game) < damageOwed(game)) {
    lose(game, out);
  }
}

function lose(game, out) {
  game.outcome = 'lose';
  game.phase = PHASE.OVER;
  out.push(events.lose());
}
