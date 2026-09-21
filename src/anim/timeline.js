/**
 * 时间线：把一次操作的 事件序列 播成动画
 *
 * 关键设计（为什么"动画坏了也不影响正确性"）：
 *   main.js 的顺序是 —— 记下旧快照与旧位置 → 跑引擎 → **先把 DOM 渲染成终态**
 *   → 再调 timeline.play()。所以动画只是"从旧位置动到已经在那儿的位置"，
 *   任何一步动画失败/被跳过，画面依然停在正确的终态。
 *
 * 跳过：按空格或点空白处 → fastForward() → 正在跑的动画直接 finish()，
 *       剩下的事件全部不再播（因为终态早就渲染好了）。
 */

import { EVENT } from '../engine/constants.js';
import { handlers } from './eventMap.js';

function toRect(el) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function createTimeline({ board, fx, views = {} }) {
  let skipping = false;
  /** @type {Promise<void>|null} */
  let active = null;

  /**
   * 通用"补位"动画：同一个元素（卡槽）在渲染前后都存在，
   * 就从旧位置滑到新位置——例如手牌打出一张后，后面的牌向左补位。
   */
  function animateReflow(beforeRects, afterRects) {
    const jobs = [];
    for (const [uid, after] of afterRects) {
      const before = beforeRects.get(uid);
      if (!before || before.el !== after.el) continue; // 只处理"还是同一个元素"
      jobs.push(fx.moveFrom(after.el, before.rect, { ms: 220 }));
    }
    return Promise.all(jobs);
  }

  function buildContext(base, index, holdings) {
    const { before, after, beforeDecks, afterDecks, beforeRects, afterRects, events } = base;
    const beforeHandUids = new Set(before.hand.map((card) => card.uid));

    const pileEl = (name) => board.piles[name].host;
    const enemyEl = () => board.enemyHost.querySelector('.card');

    const playedCardsBefore = (eventIndex) => {
      for (let i = eventIndex - 1; i >= 0; i--) {
        if (events[i].kind === EVENT.PLAY) return events[i].cards;
      }
      return [];
    };

    return {
      index,
      fx,
      before,
      after,
      beforeDecks,
      afterDecks,
      beforeRects,
      afterRects,
      events,
      /** uid → 已经"砸在 Boss 身上"的幽灵卡 wrapper（本批动画结束时统一淡出） */
      holdings,
      attackBadge: board.attackBadge,
      healthBadge: board.healthBadge,
      beforeTable: before.table,
      pileRect: (name) => {
        // 桌面上牌堆有卡面，直接用它的位置；
        // 手机上牌堆卡面被隐藏（只留小丑），落到 Boss 两侧那行数字上
        const slot = toRect(pileEl(name));
        if (slot && slot.width > 1) return slot;
        return toRect(board.resourceAnchors?.[name]);
      },
      pileCardEl: (name) => pileEl(name).querySelector('.card'),
      enemyRect: () => toRect(board.enemyHost),
      enemySlotEl: () => board.enemyHost,
      enemyEl,
      /** 动画期间滚动徽章数字用（只改显示，不改局面） */
      enemyNumbers: (patch) => views.enemy?.setNumbers(patch),
      /** 同一名王族还在场？（决定要不要滚动生命/攻击数字） */
      sameEnemy: Boolean(before.enemy && after.enemy && before.enemy.uid === after.enemy.uid),
      appearedInHand: () => after.hand.filter((card) => !beforeHandUids.has(card.uid)),
      playedCards: (eventIndex) => playedCardsBefore(eventIndex),
      recycledCards: (amount) => (amount > 0 ? beforeDecks.discard.slice(-amount).reverse() : []),
    };
  }

  /**
   * 动画开始前的"同帧预处理"，必须紧接在 render() 之后、同一个任务里调用：
   *
   *  1. 把会被动画改掉的数字退回**动画前**的值（本批结束时 main.js 会 render 回真实值）；
   *  2. 把动画期间不该露面的落点先藏起来（真牌等幽灵卡落地再显示）。
   *
   * 如果这一步和 render() 之间隔了一帧，浏览器就会先画出"动画的最终结果"，
   * 看起来就是闪屏——这正是之前的问题。
   */
  function prepare(events, base) {
    const ctx = buildContext(base, 0, new Map());

    // 1) 数字（含血条）退回旧值
    ctx.enemyNumbers({
      health: base.before.enemyHealth,
      attack: base.before.damageOwed,
      maxHealth: base.before.enemyMaxHealth,
    });
    const piles = views.piles;
    if (piles) {
      piles.castle?.setCount(base.before.castleCount);
      piles.tavern?.setCount(base.before.tavernCount);
      piles.discard?.setCount(base.before.discardCount);
      // 小丑牌堆连卡面一起退回旧状态（用掉最后一次时卡面会消失，也会闪）
      piles.joker?.render({
        card: base.before.jestersLeft > 0 ? (base.beforeDecks.jokers?.[0] ?? null) : null,
        count: base.before.jestersLeft,
        faceUp: true,
      });
    }

    // 2) 预藏落点
    const hidden = new Set();
    const hide = (el) => {
      if (el) hidden.add(el);
    };
    const hideNewHandCards = () => {
      for (const card of ctx.appearedInHand()) hide(ctx.afterRects.get(card.uid)?.el);
    };

    for (const ev of events) {
      switch (ev.kind) {
        case EVENT.SUIT_HEART:
          hide(ctx.pileCardEl('tavern'));
          break;
        case EVENT.SUIT_DIAMOND:
          hideNewHandCards();
          break;
        case EVENT.NEW_ENEMY:
          hide(ctx.afterRects.get(ev.card.uid)?.el);
          break;
        case EVENT.DEFEAT:
          hide(ctx.pileCardEl('discard'));
          hide(ctx.enemyEl());
          break;
        case EVENT.DEFEAT_EXACT:
          hide(ctx.pileCardEl('tavern'));
          hide(ctx.enemyEl());
          break;
        case EVENT.DAMAGE_PAID:
          hide(ctx.pileCardEl('discard'));
          break;
        case EVENT.JESTER_REFILL:
          hide(ctx.pileCardEl('discard'));
          hideNewHandCards();
          break;
        default:
          break;
      }
    }

    ctx.fx.hideAll([...hidden]);
  }

  async function play(events, base) {
    skipping = false;
    fx.setSkipping(false);

    /** uid → 停靠在 Boss 身上的幽灵卡 */
    const holdings = new Map();

    const run = (async () => {
      const reflow = animateReflow(base.beforeRects, base.afterRects);

      for (let i = 0; i < events.length; i++) {
        if (skipping) break;
        const handler = handlers[events[i].kind];
        if (!handler) continue;
        await handler(buildContext(base, i, holdings), events[i], i);
      }

      await reflow;
      // "砸在 Boss 上"的那批牌最后一起淡出
      await fx.fadeOutAll([...holdings.values()], { ms: 240 });
      holdings.clear();
    })();

    active = run;
    try {
      await run;
    } catch (error) {
      // 动画只是演出：出错就跳过，不能让游戏卡住
      console.warn('[anim] 动画播放出错，已忽略：', error);
    } finally {
      if (active === run) active = null;
      skipping = false;
      fx.setSkipping(false);
      // 兜底：动画中途出错或被跳过时，别把"还钉在 Boss 上"的幽灵卡留在屏幕上
      fx.discardAll([...holdings.values()]);
      holdings.clear();
    }
  }

  return {
    prepare,
    play,

    /** 跳过当前这批动画 */
    fastForward() {
      if (!active) return;
      skipping = true;
      fx.setSkipping(true);
      fx.finishAll();
    },

    get busy() {
      return active !== null;
    },
  };
}
