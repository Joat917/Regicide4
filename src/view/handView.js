/**
 * 手牌视图：一排卡片 + 序号（键盘 1..8 选牌）+ 选中态
 *
 * 位置与重叠由 CSS 的 --hand-step 决定（沿用原版 35px @146.4px 宽 ≈ 0.239 倍牌宽）。
 */

import { createCardRow } from './cardRow.js';

export function createHandView({ host }) {
  const row = createCardRow({ host, faceUp: true, indexed: true });

  return {
    host,

    render(cards, { selectedUids = null } = {}) {
      row.render(cards, { selectedUids });
    },

    /** 键盘序号（0 基）→ 该位置牌的 uid */
    uidAtIndex(cards, index) {
      return cards[index]?.uid ?? null;
    },

    /** uid → 手牌下标（确认出牌时要把它换算成引擎需要的下标） */
    indexOfUid(cards, uid) {
      return cards.findIndex((card) => card.uid === uid);
    },
  };
}
