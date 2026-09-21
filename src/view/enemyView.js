/**
 * 敌人视图：牌面 + 攻击徽章 + 生命徽章 + 生命条 + 免疫提示
 *
 * 徽章沿用原版美术约定：攻击 = 梅花图标 + 浅色数字，生命 = 红桃图标 + 红色数字。
 * 攻击徽章显示的是**实际攻击力**（原始攻击 − 黑桃减伤），也就是你这一回合要挡下的点数。
 */

import { catalog } from '../assetCatalog.js';
import { plainSuitIcon } from '../plainArt.js';
import { createCardView } from './cardView.js';
import { createDigits } from './digits.js';

export function createEnemyView({ host, attackBadge, healthBadge, hpBar }) {
  const cardView = createCardView(null, { faceUp: true });
  cardView.attachTo(host);

  const attackDigits = createDigits('num');
  const healthDigits = createDigits('rnum');
  const attackIcon = attackBadge.querySelector('.badge-icon');
  const healthIcon = healthBadge.querySelector('.badge-icon');

  const setIcon = (img, suit) => {
    img.onerror = () => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.src = plainSuitIcon(suit);
    };
    img.src = catalog.suitIconUrl(suit);
  };
  setIcon(attackIcon, 'C');
  setIcon(healthIcon, 'H');

  attackBadge.querySelector('.badge-digits').appendChild(attackDigits.el);
  healthBadge.querySelector('.badge-digits').appendChild(healthDigits.el);

  const blockNote = document.createElement('div');
  blockNote.className = 'enemy-blocked';
  blockNote.hidden = true;
  blockNote.textContent = '同花色能力被免疫';
  host.parentElement.appendChild(blockNote);

  return {
    render(state) {
      const hasEnemy = Boolean(state.enemy);
      cardView.el.style.display = hasEnemy ? '' : 'none';
      if (hasEnemy) {
        cardView.setCard(state.enemy);
        cardView.setFaceUp(true);
      }

      attackDigits.set(state.damageOwed);
      healthDigits.set(Math.max(0, state.enemyHealth));

      const ratio = state.enemyMaxHealth > 0 ? state.enemyHealth / state.enemyMaxHealth : 0;
      hpBar.style.setProperty('--hp', `${Math.max(0, Math.min(1, ratio)) * 100}%`);

      attackBadge.classList.toggle('is-reduced', state.attackReduction > 0);
      // 只有"王族被取消免疫"时才提示；单人模式没有取消手段，所以它基本不会出现。
      // （之前写反了：免疫生效时反而显示，于是这条提示一直挂在 Boss 脸上）
      blockNote.hidden = !hasEnemy || state.immunityActive;
    },

    /**
     * 只改徽章上的数字与血条（动画层用：开始前退回旧值、过程中滚动）。
     * 规则计算仍在引擎里；这里只是把中间值画出来。
     */
    setNumbers({ attack = null, health = null, maxHealth = null } = {}) {
      if (attack !== null) attackDigits.set(Math.max(0, attack));
      if (health !== null) {
        healthDigits.set(Math.max(0, health));
        if (maxHealth) {
          const ratio = Math.max(0, Math.min(1, health / maxHealth));
          hpBar.style.setProperty('--hp', `${ratio * 100}%`);
        }
      }
    },
  };
}
