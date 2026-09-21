/**
 * 牌堆视图（城堡 / 酒馆 / 弃牌 / 小丑）
 *
 * 每个牌堆 = 底图（30% 透明的牌背，由 CSS 的 .pile-bg 提供）
 *          + 一张"顶牌"（可正面或背面）
 *          + 计数徽章（数量为 0 时整个隐藏）
 */

import { catalog } from '../assetCatalog.js';
import { createCardView } from './cardView.js';
import { createDigits } from './digits.js';

export function createPileView({ host, remainHost, bgEl = null }) {
  if (bgEl) {
    // 空牌堆底图 = 30% 透明的牌背（走资源目录，换素材不影响）
    bgEl.style.backgroundImage = `url("${catalog.backUrl()}")`;
  }

  const cardView = createCardView(null, { faceUp: false });
  cardView.attachTo(host);

  const digits = createDigits('num');
  remainHost.appendChild(digits.el);

  const setCount = (count) => {
    remainHost.style.display = count > 0 ? '' : 'none';
    digits.set(count);
  };

  return {
    /** 只改计数（动画开始前把数字退回旧值用） */
    setCount,

    /**
     * @param {object} data
     * @param {object|null} [data.card]  要显示的顶牌（null = 只显示牌背）
     * @param {number} [data.count]      数量
     * @param {boolean} [data.faceUp]    顶牌是否正面朝上
     */
    render({ card = null, count = 0, faceUp = false } = {}) {
      if (card) {
        cardView.setCard(card);
        cardView.setFaceUp(faceUp);
        cardView.el.style.display = '';
      } else {
        cardView.setCard(null);
        cardView.setFaceUp(false);
        cardView.el.style.display = count > 0 ? '' : 'none';
      }
      setCount(count);
    },
  };
}
