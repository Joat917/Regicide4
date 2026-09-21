/**
 * 动画原语（Web Animations API）
 *
 * 三条纪律：
 *  1. **只用 transform（外加 opacity）**，不用 translate/scale 这类独立属性——
 *     它们在新一些的浏览器才可动画，一旦不支持，整段动画会静默失效（表现就是"瞬移"）。
 *     为了不动到卡片的翻面（`.card` 的 transform 里有 rotateY），
 *     所有位移/缩放都作用在 **.card-slot** 或幽灵元素的外层 wrapper 上。
 *  2. 形如"飞到牌堆里消失"的牌一律用**幽灵卡**：它们挂在独立的 .anim-layer 覆盖层里，
 *     不受牌行 `overflow: hidden` 的裁切（真卡片在滚动容器里飞，路径会被裁掉大半）。
 *  3. 动画只是演出：结束时 `fill: 'none'` 自动回到 CSS 状态，出错也不影响局面。
 */

import { createCardView } from '../view/cardView.js';

const EASE = 'cubic-bezier(.22,.61,.36,1)';
const MIN_MS = 16;

export function createEffects({ layer, reducedMotion = false }) {
  /** @type {Set<Animation>} */
  const running = new Set();
  let speed = 1;
  let skipping = false;

  const ms = (value) => (skipping || reducedMotion ? 1 : Math.max(MIN_MS, value / speed));
  const canAnimate = (el) => Boolean(el) && typeof el.animate === 'function';

  function track(animations) {
    const list = (animations ?? []).filter(Boolean);
    for (const animation of list) {
      running.add(animation);
      animation.finished
        .catch(() => {}) // 被 cancel 时会 reject，这里吞掉
        .finally(() => running.delete(animation));
    }
    if (list.length === 0) return Promise.resolve();
    return Promise.all(list.map((a) => a.finished.catch(() => undefined)));
  }

  /**
   * 等一会儿。
   * 注意 0 必须是"立即"，不能走 setTimeout(最小 16ms)——
   * 那会把动画的首帧推迟一帧，浏览器就会先画出一帧"动画结果"（看起来就是闪屏）。
   */
  const wait = (value) =>
    value > 0 ? new Promise((resolve) => setTimeout(resolve, ms(value))) : Promise.resolve();

  function hideAll(elements) {
    for (const el of elements ?? []) if (el) el.style.visibility = 'hidden';
  }

  function showAll(elements) {
    for (const el of elements ?? []) if (el) el.style.visibility = '';
  }

  /** 先藏起来，等 promise 结束再显示（避免"目的地已经躺着一张牌"或"落点提前出现"） */
  async function hideUntil(elements, promise) {
    const list = (elements ?? []).filter(Boolean);
    hideAll(list);
    try {
      await promise;
    } finally {
      showAll(list);
    }
  }

  // ---------------------------------------------------------------- 位移

  /** 把元素从 fromRect 的位置滑到它现在的位置（作用对象应是 .card-slot / wrapper） */
  async function moveFrom(el, fromRect, { ms: timing = 220, easing = EASE } = {}) {
    if (!canAnimate(el) || !fromRect) return;
    const to = el.getBoundingClientRect();
    const dx = fromRect.left - to.left;
    const dy = fromRect.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    await track([
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: ms(timing),
        easing,
        fill: 'none',
      }),
    ]);
  }

  // ---------------------------------------------------------------- 幽灵卡

  /**
   * 造一张"飞过去就消失"的幽灵卡
   *
   * @param {object} options
   * @param {boolean} [options.hold]      到位后**不要删**，把 wrapper 交给调用方
   *                                      （用于"砸在 Boss 身上停一下"）
   * @param {number}  [options.endScale]  到位时的缩放（出牌用 0.46：砸在 Boss 身上但不遮住它）
   * @returns {Promise<HTMLElement|null>} hold 时返回 wrapper，否则返回 null
   */
  async function ghost({
    card,
    fromRect,
    toRect,
    faceUpFrom = true,
    faceUpTo = true,
    ms: timing = 280,
    delay = 0,
    easing = EASE,
    fadeOut = false,
    endScale = 1,
    hold = false,
  }) {
    if (!card || !fromRect || !toRect || !layer) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'ghost-wrap';
    Object.assign(wrapper.style, {
      position: 'absolute',
      left: `${fromRect.left}px`,
      top: `${fromRect.top}px`,
      width: `${fromRect.width}px`,
      height: `${fromRect.height}px`,
      pointerEvents: 'none',
    });

    const view = createCardView(card, { faceUp: faceUpFrom });
    const el = view.el;
    el.classList.add('card-ghost');
    Object.assign(el.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      margin: '0',
      pointerEvents: 'none',
    });
    wrapper.appendChild(el);
    layer.appendChild(wrapper);

    const dx = toRect.left - fromRect.left;
    const dy = toRect.top - fromRect.top;
    const travel = ms(timing);
    const landed = endScale !== 1
      ? `translate(${dx}px, ${dy}px) scale(${endScale})`
      : `translate(${dx}px, ${dy}px)`;

    const motion = [
      { transform: 'translate(0px, 0px)', opacity: 1, offset: 0 },
      { transform: landed, opacity: 1, offset: fadeOut ? 0.82 : 1 },
    ];
    if (fadeOut) motion.push({ transform: landed, opacity: 0, offset: 1 });

    const animations = [
      wrapper.animate(motion, { duration: travel, delay: ms(delay), easing, fill: 'forwards' }),
    ];

    if (faceUpFrom !== faceUpTo) {
      animations.push(
        el.animate(
          [
            { transform: `rotateY(${faceUpFrom ? 180 : 0}deg)` },
            { transform: `rotateY(${faceUpTo ? 180 : 0}deg)` },
          ],
          {
            duration: Math.max(1, travel * 0.7),
            delay: ms(delay),
            easing: 'ease-in-out',
            fill: 'forwards',
          },
        ),
      );
    }

    await track(animations);
    if (hold) return wrapper;
    wrapper.remove();
    return null;
  }

  /** 把一批幽灵卡原地淡出并移除（"砸在 Boss 上"的那批牌最后这么收场） */
  async function fadeOutAll(elements, { ms: timing = 240 } = {}) {
    const list = (elements ?? []).filter((el) => el && el.isConnected);
    if (list.length === 0) return;
    await track(
      list.map((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: ms(timing),
          easing: 'ease-out',
          fill: 'forwards',
        }),
      ),
    );
    for (const el of list) el.remove();
  }

  /** 立刻移除（兜底：动画中途出错时别把幽灵卡留在屏幕上） */
  function discardAll(elements) {
    for (const el of elements ?? []) if (el) el.remove();
  }

  // ---------------------------------------------------------------- 提示性动效

  /** 缩放脉冲（作用在卡槽或徽章上，别传给 .card 本身） */
  function pulseScale(el, { ms: timing = 300, to = 1.08 } = {}) {
    if (!canAnimate(el)) return Promise.resolve();
    return track([
      el.animate([{ transform: 'scale(1)' }, { transform: `scale(${to})` }, { transform: 'scale(1)' }], {
        duration: ms(timing),
        easing: 'ease-in-out',
      }),
    ]);
  }

  function shake(el, { ms: timing = 300, dx = 7 } = {}) {
    if (!canAnimate(el)) return Promise.resolve();
    return track([
      el.animate(
        [
          { transform: 'translateX(0px)' },
          { transform: `translateX(${-dx}px)` },
          { transform: `translateX(${dx}px)` },
          { transform: 'translateX(0px)' },
        ],
        { duration: ms(timing), easing: 'ease-in-out' },
      ),
    ]);
  }

  /** 命中反馈：扩散一圈冲击环 */
  async function impact({ x, y, size = 130, ms: timing = 380 } = {}) {
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'impact';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    layer.appendChild(el);

    await track([
      el.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.35)', opacity: 0.9, offset: 0 },
          { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 0, offset: 1 },
        ],
        { duration: ms(timing), easing: 'ease-out', fill: 'forwards' },
      ),
    ]);
    el.remove();
  }

  /** 数字跳动：徽章数字是 PNG 图标拼的，只能逐帧换图 */
  async function count(from, to, onTick, { ms: timing = 320, steps = 10 } = {}) {
    const n = Math.max(1, Math.min(20, Math.round(steps)));
    if (skipping || reducedMotion || n <= 1) {
      onTick(to);
      return;
    }
    const total = ms(timing);
    for (let i = 1; i <= n; i++) {
      onTick(Math.round(from + ((to - from) * i) / n));
      if (i < n) await wait(Math.max(1, total / n));
    }
  }

  /** 从某个位置飘出一行字（伤害数字、"♠ 无效"之类） */
  async function floatText(text, { x, y, ms: timing = 520, tone = '' } = {}) {
    if (!layer) return;
    const el = document.createElement('div');
    el.className = `float-text ${tone}`.trim();
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layer.appendChild(el);

    await track([
      el.animate(
        [
          { transform: 'translate(-50%, -50%) translateY(0px)', opacity: 0, offset: 0 },
          { transform: 'translate(-50%, -50%) translateY(-10px)', opacity: 1, offset: 0.18 },
          { transform: 'translate(-50%, -50%) translateY(-44px)', opacity: 0, offset: 1 },
        ],
        { duration: ms(timing), easing: 'ease-out', fill: 'forwards' },
      ),
    ]);
    el.remove();
  }

  return {
    wait,
    moveFrom,
    ghost,
    fadeOutAll,
    discardAll,
    pulseScale,
    shake,
    impact,
    count,
    floatText,
    hideAll,
    showAll,
    hideUntil,
    finishAll() {
      for (const animation of [...running]) {
        try {
          animation.finish();
        } catch {
          // playbackRate 为 0 等情况直接忽略
        }
      }
      running.clear();
    },
    setSpeed(value) {
      speed = Math.max(0.1, Number(value) || 1);
    },
    get speed() {
      return speed;
    },
    setSkipping(value) {
      skipping = Boolean(value);
    },
  };
}
