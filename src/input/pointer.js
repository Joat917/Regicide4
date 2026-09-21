/**
 * 鼠标输入适配层：只负责"把 DOM 事件翻译成回调"，不做任何规则判断。
 * 事件委托到容器上，不给每张牌单独挂监听（牌是复用的 DOM 节点）。
 *
 * 没有确认按钮：
 *   - **点敌人卡片** = 出牌 / 弃牌
 *   - **点小丑牌堆** = 使用小丑能力
 */

export function bindPointer({ board, onCardClick, onConfirm, onJester, onSkip }) {
  const handleHandClick = (event) => {
    const el = event.target.closest?.('.card');
    if (!el || !board.handHost.contains(el)) return;
    const uid = el.dataset.uid;
    if (uid) onCardClick?.(uid);
  };

  const bindButton = (el, fn) => {
    if (!el) return () => {};
    const handler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      fn?.();
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  };

  const handleBackgroundClick = (event) => {
    // 可点元素自己处理，不要触发"跳过动画"；
    // 徽章（攻击/生命）单击无反应，也不该被当作"点空白"
    if (event.target.closest?.('button')) return;
    if (event.target.closest?.('.badge')) return;
    if (event.target.closest?.('#enemy')) return;
    if (event.target.closest?.('[data-pile="joker"]')) return;
    onSkip?.();
  };

  board.handHost.addEventListener('click', handleHandClick);
  document.addEventListener('click', handleBackgroundClick);

  const unbindButtons = [
    bindButton(board.enemyBox, onConfirm),
    bindButton(board.jokerPile, onJester),
  ];

  return () => {
    board.handHost.removeEventListener('click', handleHandClick);
    document.removeEventListener('click', handleBackgroundClick);
    unbindButtons.forEach((fn) => fn());
  };
}
