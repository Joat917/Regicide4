/**
 * 事件 → 演出 的映射表
 *
 * 每个处理器拿到 (ctx, ev, index)，返回一个 Promise（动画播完即 resolve）。
 *
 * 两条铁律：
 *  1. **凡是"牌换了个地方"（手牌↔战斗区↔牌堆），一律用幽灵卡在 .anim-layer 里飞**，
 *     不去移动真卡片——真卡片在 .card-row 里，而那是 `overflow: hidden` 的滚动容器，
 *     飞行路径会被裁掉，看起来就是"瞬移"。
 *     落点那张真牌在飞行期间用 hideAll() 藏起来，落地后再显示。
 *  2. 位移动画只作用在 **.card-slot / 幽灵 wrapper** 上（transform），
 *     绝不碰 .card 自己的 transform（那里面是翻面）。
 */

import { EVENT } from '../engine/constants.js';
import { SUIT_SYMBOL } from '../view/cardText.js';

const center = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 });

/** "加速击打"的缓动：慢起、末段猛冲 */
const STRIKE_EASING = 'cubic-bezier(.45, 0, .85, .4)';

/** 砸中后停靠的缩放：小到能看见 Boss 的大半张脸 */
const LANDING_SCALE = 0.46;

/**
 * 以 (x, y) 为中心、给定尺寸的矩形。
 * 幽灵卡是"绕自身中心缩放"的，所以按中心定位最准。
 */
const rectAt = ({ x, y }, width, height) => ({
  left: x - width / 2,
  top: y - height / 2,
  width,
  height,
});

/**
 * 一群幽灵卡一起飞；飞行期间把指定元素藏起来，飞完再显示。
 * @param {Array<{card, fromRect, toRect, faceUpFrom?, faceUpTo?}>} items
 */
async function flyGhosts(ctx, items, { ms = 300, stagger = 45, fadeOut = false, hide = [], easing } = {}) {
  const flights = items.filter((item) => item && item.card && item.fromRect && item.toRect);
  if (flights.length === 0) return;

  const targets = hide.filter(Boolean);
  ctx.fx.hideAll(targets);
  try {
    // 全部**同步**创建，错开靠 delay：这样第一帧里所有牌就已经在起点上，
    // 不会出现"某张牌先消失、过一会儿才飞出来"的空档
    await Promise.all(
      flights.map((flight, i) =>
        ctx.fx.ghost({
          card: flight.card,
          fromRect: flight.fromRect,
          toRect: flight.toRect,
          faceUpFrom: flight.faceUpFrom ?? true,
          faceUpTo: flight.faceUpTo ?? true,
          ms,
          fadeOut,
          easing,
          delay: i * stagger,
        }),
      ),
    );
  } finally {
    ctx.fx.showAll(targets);
  }
}

async function defeatAnimation(ctx, royal, exact) {
  // 王族被击败：钉在它身上的牌先淡出（"被吸收"），它自己再飞向牌堆
  void ctx.fx.fadeOutAll([...ctx.holdings.values()], { ms: 200 });
  ctx.holdings.clear();

  const targetName = exact ? 'tavern' : 'discard';
  const target = ctx.pileRect(targetName);
  // 场上那些牌都在 Boss 身上（没有"打出行"了），所以统一从 Boss 的位置飞出去
  const from = ctx.enemyRect();

  const items = [
    {
      card: royal,
      fromRect: from,
      toRect: target,
      faceUpFrom: true,
      faceUpTo: !exact, // 精确击杀 → 面朝下落到牌堆顶
    },
    ...ctx.beforeTable.map((card) => ({
      card,
      fromRect: from,
      toRect: target,
      faceUpFrom: true,
      faceUpTo: !exact,
    })),
  ];

  await flyGhosts(ctx, items, {
    ms: 380,
    stagger: 50,
    hide: [ctx.pileCardEl(targetName), ctx.enemyEl()],
  });

  if (exact) {
    const at = center(ctx.enemyRect());
    await ctx.fx.floatText('精确击杀！', { ...at, tone: 'is-good', ms: 520 });
  }
}

export const handlers = {
  /**
   * 出牌：手牌 **加速砸到 Boss 身上**。
   *
   * 砸中后不是盖在 Boss 脸上，而是缩小到 46% 停在 Boss 下半部偏左的一小簇里，
   * 所以 Boss 在任何时刻都至少露出一大半——这也是"牌不许盖住 Boss"的要求。
   * 牌停在 Boss 上（hold）后，随后的花色事件还能高亮它，本批动画结束时统一淡出。
   */
  [EVENT.PLAY]: async (ctx, ev) => {
    const enemy = ctx.enemyRect();
    if (!enemy) return;

    /** 第 i 张的落点：Boss 下半部偏左，错开排布成一簇 */
    const landing = (i) =>
      rectAt(
        {
          x: enemy.left + enemy.width * (0.3 + (i % 3) * 0.15),
          y: enemy.top + enemy.height * (0.7 + (i % 2) * 0.06),
        },
        enemy.width,
        enemy.height,
      );

    const items = ev.cards
      .map((card, i) => ({ card, i, fromRect: ctx.beforeRects.get(card.uid)?.rect }))
      .filter((item) => item.fromRect);
    if (items.length === 0) return;

    // 同样：全部同步创建（错开用 delay），第一帧就能看到它们在手上准备冲刺
    const holders = await Promise.all(
      items.map((item) =>
        ctx.fx.ghost({
          card: item.card,
          fromRect: item.fromRect,
          toRect: landing(item.i),
          ms: 300,
          easing: STRIKE_EASING,
          endScale: LANDING_SCALE,
          hold: true,
          delay: item.i * 40,
        }),
      ),
    );
    items.forEach((item, i) => {
      if (holders[i]) ctx.holdings.set(item.card.uid, holders[i]);
    });
  },

  /** ♥ 红桃：弃牌堆 → 酒馆牌堆底部（翻成背面） */
  [EVENT.SUIT_HEART]: async (ctx, ev) => {
    const cards = ctx.recycledCards(ev.amount);
    if (cards.length === 0) return;
    const from = ctx.pileRect('discard');
    const to = ctx.pileRect('tavern');
    await flyGhosts(
      ctx,
      cards.map((card) => ({ card, fromRect: from, toRect: to, faceUpFrom: true, faceUpTo: false })),
      { ms: 320, stagger: 45, hide: [ctx.pileCardEl('tavern')] },
    );
  },

  /** ♦ 方块：酒馆牌堆 → 手牌（背面飞过来，落地时翻正） */
  [EVENT.SUIT_DIAMOND]: async (ctx) => {
    const from = ctx.pileRect('tavern');
    const items = ctx
      .appearedInHand()
      .map((card) => ({
        card,
        fromRect: from,
        toRect: ctx.afterRects.get(card.uid)?.rect,
        target: ctx.afterRects.get(card.uid)?.el,
        faceUpFrom: false,
        faceUpTo: true,
      }))
      .filter((item) => item.toRect);

    await flyGhosts(ctx, items, { ms: 320, stagger: 55, hide: items.map((i) => i.target) });
  },

  /** ♠ 黑桃：高亮已经砸在 Boss 上的黑桃 + 攻击徽章数字滚下来 */
  [EVENT.SUIT_SPADE]: async (ctx, ev, index) => {
    const spades = ctx.playedCards(index).filter((card) => card.suit === 'S');
    await Promise.all([
      ...spades.map((card) => ctx.fx.pulseScale(ctx.holdings.get(card.uid), { to: 1.14, ms: 320 })),
      ctx.fx.pulseScale(ctx.attackBadge, { to: 1.2, ms: 340 }),
      ctx.fx.floatText(`♠ 减伤 ${ev.amount}`, { ...center(ctx.enemyRect()), tone: 'is-good' }),
      ctx.sameEnemy
        ? ctx.fx.count(ctx.before.damageOwed, ctx.after.damageOwed, (value) =>
            ctx.enemyNumbers({ attack: value }),
          { ms: 340 })
        : null,
    ]);
  },

  /** ♣ 梅花：高亮梅花 + 敌人抖一下 */
  [EVENT.SUIT_CLUB]: async (ctx, ev, index) => {
    const clubs = ctx.playedCards(index).filter((card) => card.suit === 'C');
    await Promise.all([
      ...clubs.map((card) => ctx.fx.pulseScale(ctx.holdings.get(card.uid), { to: 1.16, ms: 320 })),
      ctx.fx.shake(ctx.enemySlotEl(), { dx: 6, ms: 320 }),
      ctx.fx.floatText(`♣ 翻倍 → ${ev.amount}`, { ...center(ctx.enemyRect()), tone: 'is-accent' }),
    ]);
  },

  /** 同花色免疫 */
  [EVENT.SUIT_BLOCKED]: async (ctx, ev) => {
    await ctx.fx.floatText(`${SUIT_SYMBOL[ev.suit] ?? ev.suit} 能力被免疫`, {
      ...center(ctx.enemyRect()),
      tone: 'is-warn',
      ms: 480,
    });
  },

  /** 造成伤害：飘伤害数字 + 生命徽章数字滚动 + 冲击环 */
  [EVENT.DAMAGE]: async (ctx, ev) => {
    const at = center(ctx.enemyRect());
    await Promise.all([
      ctx.fx.floatText(`-${ev.amount}`, { ...at, tone: 'is-accent' }),
      ctx.fx.pulseScale(ctx.healthBadge, { to: 1.22, ms: 320 }),
      ctx.fx.impact({ x: at.x, y: at.y, size: ctx.enemyRect().width * 1.1, ms: 380 }),
      ctx.sameEnemy
        ? ctx.fx.count(
            ctx.before.enemyHealth,
            Math.max(0, ctx.after.enemyHealth),
            (value) => ctx.enemyNumbers({ health: value }),
            { ms: 360 },
          )
        : null,
    ]);
  },

  [EVENT.DEFEAT]: (ctx, ev) => defeatAnimation(ctx, ev.card, false),
  [EVENT.DEFEAT_EXACT]: (ctx, ev) => defeatAnimation(ctx, ev.card, true),

  /** 新敌人：城堡牌堆 → 战斗区，路上翻面 */
  [EVENT.NEW_ENEMY]: async (ctx, ev) => {
    const target = ctx.afterRects.get(ev.card.uid);
    if (!target) return;
    await flyGhosts(
      ctx,
      [
        {
          card: ev.card,
          fromRect: ctx.pileRect('castle'),
          toRect: target.rect,
          faceUpFrom: false,
          faceUpTo: true,
        },
      ],
      { ms: 420, stagger: 0, hide: [target.el] },
    );
  },

  /** 王族反击：敌人抖动 + 攻击徽章跳 + 提示要挡多少 */
  [EVENT.COUNTERATTACK]: async (ctx, ev) => {
    await Promise.all([
      ctx.fx.shake(ctx.enemySlotEl(), { dx: 8, ms: 320 }),
      ev.amount > 0 ? ctx.fx.pulseScale(ctx.attackBadge, { to: 1.2 }) : null,
      ev.amount > 0
        ? ctx.fx.floatText(`需挡 ${ev.amount}`, { ...center(ctx.enemyRect()), tone: 'is-warn' })
        : null,
    ]);
  },

  /** 弃牌挡伤害：手牌 → 弃牌堆 */
  [EVENT.DAMAGE_PAID]: async (ctx, ev) => {
    const to = ctx.pileRect('discard');
    const items = ev.cards.map((card) => ({
      card,
      fromRect: ctx.beforeRects.get(card.uid)?.rect,
      toRect: to,
      faceUpFrom: true,
      faceUpTo: true,
    }));
    await flyGhosts(ctx, items, { ms: 300, stagger: 45, hide: [ctx.pileCardEl('discard')] });
  },

  /** 小丑能力：整手牌飞进弃牌堆，再从酒馆补满 */
  [EVENT.JESTER_REFILL]: async (ctx, ev) => {
    const toDiscard = ctx.pileRect('discard');
    await flyGhosts(
      ctx,
      ev.cards.map((card) => ({
        card,
        fromRect: ctx.beforeRects.get(card.uid)?.rect,
        toRect: toDiscard,
        faceUpFrom: true,
        faceUpTo: false,
      })),
      { ms: 240, stagger: 30, hide: [ctx.pileCardEl('discard')] },
    );

    const fromTavern = ctx.pileRect('tavern');
    const drawn = ctx
      .appearedInHand()
      .map((card) => ({
        card,
        fromRect: fromTavern,
        toRect: ctx.afterRects.get(card.uid)?.rect,
        target: ctx.afterRects.get(card.uid)?.el,
        faceUpFrom: false,
        faceUpTo: true,
      }))
      .filter((item) => item.toRect);
    await flyGhosts(ctx, drawn, { ms: 260, stagger: 40, hide: drawn.map((i) => i.target) });
  },

  // win / lose 由结算面板负责，不需要动画
};

export { defeatAnimation };
