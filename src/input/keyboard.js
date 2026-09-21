/**
 * 键盘输入适配层：同样只做翻译，不做规则判断。
 *
 *   1..8   选/取消选第 N 张手牌（只看手牌从左到右的序号）
 *   Enter  确认出牌 / 确认弃牌挡伤害
 *   Esc    取消选择
 *   J      使用小丑能力
 *   Space  跳过动画（M3 的 timeline.fastForward）
 */

export function bindKeyboard({ onToggleIndex, onConfirm, onCancel, onJester, onSkip }) {
  const handler = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;

    if (key >= '1' && key <= '8') {
      onToggleIndex?.(Number(key) - 1);
      event.preventDefault();
      return;
    }
    if (key === 'Enter') {
      onConfirm?.();
      event.preventDefault();
      return;
    }
    if (key === 'Escape') {
      onCancel?.();
      event.preventDefault();
      return;
    }
    if (key === 'j' || key === 'J') {
      onJester?.();
      return;
    }
    if (key === ' ') {
      onSkip?.();
      event.preventDefault();
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
