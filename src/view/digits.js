/**
 * 两位数显示：用 icons/num-N.png（浅色）或 icons/rnum-N.png（红色）拼数字，
 * 沿用 regicideHQ 的视觉约定。
 *
 * 细节：
 *  - 小于 10 时**只画一位**，不再补前导零（空牌堆显示 "00" 很难看）；
 *  - 某个数字图缺失时退回内置矢量数字（只放了一部分自备美术也不会出现破图）。
 */

import { catalog } from '../assetCatalog.js';
import { plainDigit } from '../plainArt.js';

export function createDigits(kind = 'num') {
  const el = document.createElement('span');
  el.className = 'digits';

  const tens = document.createElement('img');
  const units = document.createElement('img');
  tens.alt = '';
  units.alt = '';

  for (const img of [tens, units]) {
    img.onerror = () => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.src = plainDigit(Number(img.dataset.digit ?? 0), kind);
    };
  }

  el.append(tens, units);

  const paint = (img, digit) => {
    img.dataset.digit = String(digit);
    img.src = catalog.iconUrl(kind, digit);
  };

  const set = (value) => {
    const n = Number.isFinite(value) ? Math.max(0, Math.min(99, Math.floor(value))) : 0;
    const twoDigits = n >= 10;
    tens.hidden = !twoDigits;
    if (twoDigits) paint(tens, Math.floor(n / 10));
    paint(units, n % 10);
  };
  set(0);

  return { el, set };
}
