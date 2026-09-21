/**
 * 一排卡片的容器（手牌用）
 *
 * 结构：.card-row > .card-slot > .card
 *   - 位置、层级、动画（transform）都作用在 **.card-slot** 上；
 *   - .card 自己只负责翻面。
 *   这样动画用兼容性最好的 transform 也不会破坏 3D 翻面。
 *
 * 也按 uid 复用节点：一张牌在整局里只对应一个槽，牌只在牌堆之间移动。
 * 重叠步进 `--row-step` 由 CSS 决定（桌面 = 手牌步进，手机 = 卡宽即不重叠），
 * 所以这里不设内联样式，免得覆盖媒体查询。
 */

import { createCardView } from './cardView.js';

/**
 * @param {object} options
 * @param {HTMLElement} options.host   容器元素
 * @param {boolean} [options.faceUp]   正面朝上？
 * @param {boolean} [options.indexed]  是否标注 1..N 序号（键盘选牌用）
 */
export function createCardRow({ host, faceUp = true, indexed = false }) {
  /** @type {Map<string, {view: ReturnType<typeof createCardView>, slot: HTMLElement}>} */
  const entries = new Map();

  host.classList.add('card-row');

  return {
    host,

    render(cards, { selectedUids = null } = {}) {
      const seen = new Set();

      cards.forEach((card, i) => {
        let entry = entries.get(card.uid);
        if (!entry) {
          const view = createCardView(card, { faceUp });
          const slot = document.createElement('div');
          slot.className = 'card-slot';
          slot.appendChild(view.el);
          host.appendChild(slot);
          entry = { view, slot };
          entries.set(card.uid, entry);
        } else if (entry.view.card !== card) {
          entry.view.setCard(card);
        }

        entry.slot.style.setProperty('--i', String(i));
        entry.slot.dataset.uid = card.uid;
        if (indexed) entry.slot.dataset.index = String(i + 1);
        entry.view.setSelected(Boolean(selectedUids && selectedUids.has(card.uid)));
        seen.add(card.uid);
      });

      for (const [uid, entry] of [...entries]) {
        if (!seen.has(uid)) {
          entry.slot.remove();
          entries.delete(uid);
        }
      }
    },

    clear() {
      for (const entry of entries.values()) entry.slot.remove();
      entries.clear();
    },
  };
}
