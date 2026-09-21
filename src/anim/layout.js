/**
 * 位置测量：动画的"从哪到哪"全靠它
 *
 * 用 FLIP 思路：渲染成终态之前先量一次（First），渲染之后再量一次（Last），
 * 然后让元素从"反推出来的旧位置"动到当前位置（Invert + Play）。
 * 动画只改 CSS 的独立属性 translate / scale，不动 transform，
 * 所以不会打乱牌面翻转用的 rotateY。
 */

/** DOMRect → 普通对象（避免持有会变的实时对象） */
function toRect(rect) {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function createLayout(root = document) {
  return {
    /**
     * 把所有可见的牌量一遍：uid → { el, rect }
     * 行内的牌用 **.card-slot** 代表（动画作用在卡槽上），
     * 牌堆/敌人那种单张牌则用 .card 自身。
     */
    measure() {
      const rects = new Map();
      for (const el of root.querySelectorAll('.card-slot[data-uid], .card[data-uid]')) {
        if (el.closest('.anim-layer')) continue; // 幽灵层不算
        if (el.classList.contains('card') && el.closest('.card-slot')) continue; // 行内牌交给卡槽
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        rects.set(el.dataset.uid, { el, rect: toRect(rect) });
      }
      return rects;
    },

    rectOf(el) {
      return el ? toRect(el.getBoundingClientRect()) : null;
    },
  };
}
