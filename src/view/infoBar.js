/**
 * 屏幕中央的状态指示 + 结算面板
 *
 * 原则（按需求收敛）：
 *   - 攻击/生命只在敌人徽章里显示，这里不重复；
 *   - 手牌/牌堆/小丑的数量各自有指示（手牌看得见、牌堆徽章、小丑牌堆徽章），这里不重复；
 *   - 只显示三件事：阶段 · 当前要求/提示 · 已选牌预览，且水平居中。
 */

import { cardText, phaseText, tierText } from './cardText.js';

/**
 * @param {object} deps 直接传 createBoard() 的返回值即可（键名与 board 对齐）
 */
export function createInfoBar({
  status: { phase: phaseEl, hint: hintEl, selection: selectionEl } = {},
  result: resultEl,
  resultText: resultTextEl,
  resultTier: resultTierEl,
} = {}) {
  for (const [name, el] of Object.entries({
    phaseEl,
    hintEl,
    selectionEl,
    resultEl,
    resultTextEl,
    resultTierEl,
  })) {
    if (!el) throw new Error(`createInfoBar: 缺少元素 ${name}（应传入 createBoard() 的返回值）`);
  }

  return {
    render(state, extra = {}) {
      const { selection = [], selectionPreview = null, message = '', messageTone = '' } = extra;
      const inDamage = state.phase === 'damage' && !state.outcome;

      // 有提示时就不显示阶段文字了——"出牌阶段"这四个字在有具体指引时毫无用处
      phaseEl.textContent = phaseText(state);
      phaseEl.hidden = Boolean(message);
      phaseEl.classList.toggle('is-warn', inDamage);

      // 提示：由 main.js 算好传进来。
      // messageTone === 'warn' 才标红（非法组合、点数不够），'info' 只是普通指引
      hintEl.textContent = message;
      hintEl.classList.toggle('is-warn', messageTone === 'warn');

      // 已选预览
      if (selection.length) {
        const preview = selectionPreview ? ` → 伤害 ${selectionPreview.damage}` : '';
        selectionEl.textContent = `已选 ${selection.map(cardText).join(' + ')}${preview}`;
      } else {
        selectionEl.textContent = '';
      }
    },

    showResult(state) {
      resultEl.hidden = false;
      resultEl.classList.toggle('is-win', state.outcome === 'win');
      resultEl.classList.toggle('is-lose', state.outcome === 'lose');
      resultTextEl.textContent =
        state.outcome === 'win'
          ? `胜利：12 名王族全部伏诛，用了 ${2 - state.jestersLeft} 次小丑能力。`
          : '失败：没能挡下王族的反击。';
      resultTierEl.textContent = tierText(state.victoryTier);
    },

    hideResult() {
      resultEl.hidden = true;
      resultEl.classList.remove('is-win', 'is-lose');
    },

    /** 资源/启动出错时用它显示一行警告 */
    alert(text) {
      phaseEl.textContent = '';
      hintEl.textContent = text;
      hintEl.classList.add('is-warn');
      selectionEl.textContent = '';
    },
  };
}
