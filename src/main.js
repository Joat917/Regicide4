/**
 * 应用装配层：把 引擎 / 视图 / 动画时间线 / 输入 接在一起。
 *
 * 一次操作的完整流程（M3 之后）：
 *
 *   1. 记下旧快照、旧牌堆内容、**旧位置**（layout.measure()）
 *   2. 调引擎（纯计算）得到事件数组与新快照
 *   3. **先把 DOM 渲染成终态**，再量一次新位置
 *   4. timeline.play(events) 只负责"从旧位置动到当前位置"的演出
 *   5. 动画结束（或被跳过）后刷新信息条与按钮
 *
 * 这样即使动画出错或被跳过，画面也永远停在正确的终态。
 * 这一层只管装配与协调：规则在 src/engine，渲染在 src/view，动画在 src/anim。
 */

import { createEffects } from './anim/effects.js';
import { createLayout } from './anim/layout.js';
import { createTimeline } from './anim/timeline.js';
import { catalog } from './assetCatalog.js';
import { PHASE } from './engine/constants.js';
import { explainPlay, findMoveForCards, previewPlay } from './engine/moves.js';
import { createSoloGame } from './engine/soloGame.js';
import { bindKeyboard } from './input/keyboard.js';
import { bindPointer } from './input/pointer.js';
import { createBoard } from './view/board.js';
import { explainPlayText } from './view/cardText.js';
import { createEnemyView } from './view/enemyView.js';
import { describeEvents } from './view/eventText.js';
import { createHandView } from './view/handView.js';
import { createInfoBar } from './view/infoBar.js';
import { createPileView } from './view/pileView.js';

const PARAMS = new URLSearchParams(window.location.search);
const DEBUG = PARAMS.has('debug');
/**
 * 动画开关。
 *   默认：开
 *   ?motion=off  关闭（CSS 过渡与 JS 动画一起降到 1ms）
 *   ?motion=auto 遵循系统的「减少动态效果」
 * 之所以不默认遵循系统设置：本游戏的动画承担了信息表达（这张牌从哪来、往哪去），
 * 静默关掉会让所有牌看起来在瞬移，而且极难排查。
 */
const MOTION_PARAM = PARAMS.get('motion');
/**
 * 美术来源。
 *   默认（无参数）：能用 assets/manifest.json 就用，读不到自动退回内置简易牌面
 *   ?art=plain     强制用内置简易牌面（零资源）
 *   ?art=file      只用 assets/ 里的图，读不到就报错（排查资源问题时用）
 */
const ART_PARAM = PARAMS.get('art');

function seedFromUrl() {
  const raw = PARAMS.get('seed');
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : Date.now() % 1000000;
}

async function boot() {
  const board = createBoard(document);
  const layout = createLayout(document);
  const prefersReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const motionEnabled =
    MOTION_PARAM === 'off' ? false : MOTION_PARAM === 'auto' ? !prefersReducedMotion : true;
  if (!motionEnabled) document.documentElement.classList.add('reduce-motion');

  const fx = createEffects({ layer: board.animLayer, reducedMotion: !motionEnabled });
  console.info(
    `[regicide] 动画：${motionEnabled ? '开启' : '关闭'}` +
      (prefersReducedMotion ? '（检测到系统「减少动态效果」）' : '') +
      (MOTION_PARAM ? `（?motion=${MOTION_PARAM}）` : ''),
  );
  const info = createInfoBar(board);

  // 视图引用先建空壳、后填：时间线只在播动画时才读它（比如滚动敌人徽章数字），
  // 所以不怕声明顺序，也避免 "Cannot access before initialization" 这类问题
  const views = {};
  const timeline = createTimeline({ board, fx, views: views });

  /*
   * 资源模式必须**在建视图之前**定下来：
   * 牌背、数字图标、花色图标都是视图构造时读 catalog 的 URL，
   * 那会儿还没 load 的话会先按"文件模式"发一批请求（plain 模式下就是一堆 404）。
   */
  if (ART_PARAM === 'plain') {
    // 明确要求内置牌面时，连 manifest 都不去读 —— 一次 assets/ 请求都不发
    catalog.usePlainArt();
  } else {
    try {
      await catalog.load('assets/', { plainFallback: true });
    } catch (err) {
      // 只有 ?art=file 会走到这里（其它情况 load 内部已经退回简易牌面）
      info.alert(`资源未就绪：${err.message}`);
      return;
    }
  }
  if (catalog.usesPlainArt) {
    board.artNote.hidden = false;
    board.artNote.textContent = '简易牌面';
    board.artNote.title =
      ART_PARAM === 'plain'
        ? '用 ?art=plain 强制使用内置牌面；去掉这个参数即可加载 assets/ 里的美术'
        : '没找到 assets/manifest.json，正在使用内置生成的牌面。补齐美术资源的几种方式见 web/ART.md';
  }

  const piles = {
    castle: createPileView(board.piles.castle),
    tavern: createPileView(board.piles.tavern),
    discard: createPileView(board.piles.discard),
    joker: createPileView(board.piles.joker),
  };
  views.piles = piles;

  const enemyView = createEnemyView({
    host: board.enemyHost,
    attackBadge: board.attackBadge,
    healthBadge: board.healthBadge,
    hpBar: board.hpBar,
  });
  views.enemy = enemyView;

  const handView = createHandView({ host: board.handHost });

  /** @type {ReturnType<typeof createSoloGame>} */
  let game = null;
  /** 选中的手牌 uid */
  let selection = new Set();
  let busy = false;
  let hint = '';

  // ------------------------------------------------------------ 渲染

  function selectionInfo(state) {
    const cards = state.hand.filter((card) => selection.has(card.uid));
    const preview = cards.length ? previewPlay(cards, state.enemy, false) : null;
    return { cards, preview };
  }

  function render() {
    if (!game) return;
    const state = game.state();
    const decks = game.inspect();

    piles.castle.render({ count: state.castleCount });
    piles.tavern.render({ count: state.tavernCount });
    piles.discard.render({
      count: state.discardCount,
      card: decks.discard[decks.discard.length - 1] ?? null,
      faceUp: true,
    });
    piles.joker.render({
      count: state.jestersLeft,
      card: state.jestersLeft > 0 ? decks.jokers[0] : null,
      faceUp: true,
    });

    enemyView.render(state);
    handView.render(state.hand, { selectedUids: selection });

    // 手机上的牌堆信息（文字）；桌面上这几个元素是隐藏的，写入无副作用
    board.resourceAnchors.castle.textContent = String(state.castleCount);
    board.resourceAnchors.tavern.textContent = String(state.tavernCount);
    board.resourceAnchors.discard.textContent = String(state.discardCount);

    const { cards, preview } = selectionInfo(state);
    const ids = cards
      .map((card) => state.hand.findIndex((entry) => entry.uid === card.uid))
      .filter((index) => index >= 0);

    // 合法性在渲染时就算好：不合法就**不许按**，并给出针对这手牌的原因
    const inDamage = state.phase === PHASE.DAMAGE && !state.outcome;
    const playReason = inDamage ? null : explainPlay(cards);
    const payment = inDamage && ids.length > 0 ? game.validatePayment(ids) : null;
    const legal =
      !state.outcome && ids.length > 0 && (inDamage ? Boolean(payment.ok) : playReason === null);

    let message = hint;
    let messageTone = hint ? 'warn' : '';
    if (!message && !state.outcome) {
      if (inDamage) {
        const selected = cards.reduce((sum, card) => sum + card.value, 0);
        if (ids.length === 0) {
          message = `需要弃掉合计 ≥ ${state.damageOwed} 点的牌`;
          messageTone = 'info';
        } else if (selected < state.damageOwed) {
          message = `还差 ${state.damageOwed - selected} 点`;
          messageTone = 'warn';
        } else {
          message = '点敌人弃牌挡伤害';
          messageTone = 'info';
        }
      } else if (cards.length === 0) {
        message = ''; // 没选牌就不啰嗦——这时才轮到"出牌阶段"四个字露面
      } else if (playReason) {
        message = explainPlayText(playReason);
        messageTone = 'warn';
      } else {
        message = '点敌人出牌';
        messageTone = 'info';
      }
    }

    // 只在"出牌阶段 + 这组合法"时显示 → 伤害 N：
    // 非法组合的伤害数字没有意义，弃牌阶段看伤害也没有意义（那时要的是够不够挡）
    info.render(state, {
      selection: cards,
      selectionPreview: legal && !inDamage ? preview : null,
      message,
      messageTone,
    });

    // 没有确认按钮：选中合法的牌组后，Boss 本身变成"确认键"
    board.enemyBox.classList.toggle('is-ready', legal && !busy);
    // 小丑能力也没有按钮：点小丑牌堆即可。这里只标出它此刻能不能点
    board.jokerPile.classList.toggle('is-available', !busy && game.canUseJester());
  }

  // ------------------------------------------------------------ 操作

  /**
   * 执行一次操作并播放动画。
   * @param {() => Array} action 调引擎的动作，可能抛错（非法操作）
   */
  async function perform(action) {
    if (busy || !game) return;
    busy = true;

    const before = game.state();
    const beforeDecks = game.inspect();
    const beforeRects = layout.measure();

    let events;
    try {
      events = action();
    } catch (err) {
      hint = err.message;
      busy = false;
      render();
      return;
    }

    const after = game.state();
    const afterDecks = game.inspect();

    selection = new Set();
    hint = '';
    render(); // DOM 先到终态，动画只是"从旧位置动过来"

    const afterRects = layout.measure();
    const animBase = { before, after, beforeDecks, afterDecks, beforeRects, afterRects, events };

    // prepare 与 play 必须和上面的 render() 在同一个任务里跑完：
    // 否则浏览器会先画一帧"动画的最终结果"，看起来就是闪屏
    timeline.prepare(events, animBase);
    await timeline.play(events, animBase);

    if (DEBUG) console.debug('[regicide]', describeEvents(events).join(' · '));
    busy = false;
    render(); // 动画结束后再刷一次：状态指示与按钮
    if (after.outcome) info.showResult(after);
  }

  function toggleCard(uid) {
    if (!game || busy) return;
    const state = game.state();
    if (state.outcome) return;
    if (selection.has(uid)) selection.delete(uid);
    else selection.add(uid);
    hint = '';
    render();
  }

  function cancelSelection() {
    if (!game || busy) return;
    selection = new Set();
    hint = '';
    render();
  }

  async function confirm() {
    if (!game || busy) return;
    const state = game.state();
    if (state.outcome) return;

    const ids = [...selection]
      .map((uid) => state.hand.findIndex((card) => card.uid === uid))
      .filter((i) => i >= 0);
    if (ids.length === 0) {
      hint = '先点几张手牌';
      render();
      return;
    }

    if (state.phase === PHASE.DAMAGE) {
      const check = game.validatePayment(ids);
      if (!check.ok) {
        hint = check.reason;
        render();
        return;
      }
      await perform(() => game.payDamage(ids));
      return;
    }

    const move = findMoveForCards(game.legalMoves(), ids);
    if (!move) {
      hint = '这组牌不合法：同点数组合的总和不能超过 10，A 只能单独出或与 1 张牌搭配';
      render();
      return;
    }
    await perform(() => game.playMove(move));
  }

  async function useJester() {
    if (!game || busy) return;
    if (!game.canUseJester()) {
      hint = '小丑能力已用完，或当前不能使用';
      render();
      return;
    }
    await perform(() => game.useJester());
  }

  function newGame() {
    const seed = seedFromUrl();
    game = createSoloGame({ seed });
    selection = new Set();
    hint = '';
    busy = false;
    info.hideResult();
    if (DEBUG) console.debug(`[regicide] 新开一局 seed=${seed}`);
    render();
  }

  // ------------------------------------------------------------ 输入绑定

  bindPointer({
    board,
    onCardClick: toggleCard,
    onConfirm: confirm,
    onJester: useJester,
    onSkip: () => timeline.fastForward(),
  });

  bindKeyboard({
    onToggleIndex: (index) => {
      if (!game) return;
      const uid = handView.uidAtIndex(game.state().hand, index);
      if (uid) toggleCard(uid);
    },
    onConfirm: confirm,
    onCancel: cancelSelection,
    onJester: useJester,
    onSkip: () => timeline.fastForward(),
  });

  board.buttons.restart?.addEventListener('click', () => newGame());

  // ------------------------------------------------------------ 启动

  newGame();
}

boot().catch((err) => {
  console.error(err);
  const hint = document.querySelector('#hint');
  if (hint) {
    hint.textContent = `启动失败：${err.message}`;
    hint.classList.add('is-warn');
  }
});
