/**
 * 把牌与事件翻译成人话（纯字符串处理，不碰 DOM）
 */

export const SUIT_SYMBOL = Object.freeze({ C: '♣', D: '♦', H: '♥', S: '♠' });
export const SUIT_NAME = Object.freeze({ C: '梅花', D: '方块', H: '红桃', S: '黑桃' });

export function cardText(card) {
  if (!card) return '—';
  if (card.isJoker) return '小丑';
  return `${SUIT_SYMBOL[card.suit] ?? '?'}${card.rank}`;
}

export function cardsText(cards) {
  if (!cards || cards.length === 0) return '（空）';
  return cards.map(cardText).join(' + ');
}

/**
 * 把引擎给出的"不能出的原因"翻译成一句短话（针对性提示）
 * @param {ReturnType<import('../engine/moves.js').explainPlay>} reason
 */
export function explainPlayText(reason) {
  if (!reason) return '';
  switch (reason.code) {
    case 'empty':
      return '先选牌';
    case 'mixed':
      return '点数不同，不能一起出';
    case 'sum':
      return `合计 ${reason.sum} 点，超过 ${reason.limit}`;
    case 'ace':
      return 'A 只能单独出，或与 1 张牌搭配';
    case 'royalOnly':
      return '归顺的王牌只能单独出';
    case 'joker':
      return '小丑不能当牌出';
    default:
      return '这组牌不能出';
  }
}

export function phaseText(state) {
  if (state.outcome === 'win') return '胜利';
  if (state.outcome === 'lose') return '失败';
  return state.phase === 'damage' ? '承受反击' : '出牌阶段';
}

export function tierText(tier) {
  return (
    {
      gold: '金牌 🥇 · 未动用小丑能力',
      silver: '银牌 🥈 · 用掉 1 次小丑能力',
      bronze: '铜牌 🥉 · 用掉 2 次小丑能力',
    }[tier] ?? ''
  );
}
