/**
 * 棋盘结构：把 index.html 里的元素一次性抓出来，供各视图与输入层使用。
 * 这里只做"取元素"，不创建、不改结构。
 */

export function createBoard(root = document) {
  const $ = (sel) => {
    const el = root.querySelector(sel);
    if (!el) throw new Error(`页面结构缺少元素：${sel}`);
    return el;
  };

  const pile = (name) => ({
    host: $(`[data-pile="${name}"] .pile-slot`),
    remainHost: $(`[data-pile="${name}"] .pile-remain`),
    bgEl: $(`[data-pile="${name}"] .pile-bg`),
  });

  return {
    handHost: $('#hand'),
    enemyHost: $('#enemy .enemy-slot'),
    /** 点它 = 出牌 / 弃牌 */
    enemyBox: $('#enemy'),
    attackBadge: $('#enemy .badge-attack'),
    healthBadge: $('#enemy .badge-health'),
    hpBar: $('#enemy .enemy-hpbar'),
    piles: {
      castle: pile('castle'),
      tavern: pile('tavern'),
      discard: pile('discard'),
      joker: pile('joker'),
    },
    /** 点它 = 使用小丑能力 */
    jokerPile: $('[data-pile="joker"]'),
    /**
     * 手机上的牌堆信息（文字）。这些 <b> 同时充当"飞向该牌堆"的动画锚点：
     * 手机上图不到牌堆卡面，就用这几个数字的位置当落点。
     */
    resourceAnchors: {
      castle: $('#res-castle'),
      tavern: $('#res-tavern'),
      discard: $('#res-discard'),
    },
    status: {
      phase: $('#phase'),
      hint: $('#hint'),
      selection: $('#selection'),
    },
    shortcuts: $('#shortcuts'),
    /** 顶栏里"简易牌面"提示 */
    artNote: $('#art-note'),
    buttons: {
      restart: $('#btn-restart'),
    },
    animLayer: $('#anim-layer'),
    result: $('#result'),
    resultText: $('#result-text'),
    resultTier: $('#result-tier'),
  };
}
