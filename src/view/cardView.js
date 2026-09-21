/**
 * 单张卡片的 DOM 视图
 *
 * 结构：  .card > .card-face.card-front > img
 *                 .card-face.card-back  > img
 *
 * 朝向沿用原版的 3D 约定：牌背朝观众是默认状态，加 .is-faceup 后翻面显示正面。
 * **不克隆节点**：一张牌一个元素，反复复用（动画由 anim/ 层操作同一个元素）。
 */

import { catalog } from '../assetCatalog.js';
import { plainBack, plainFace } from '../plainArt.js';
import { cardText } from './cardText.js';

/** 图片加载失败时的兜底：换成内置牌面，避免出现破图（每张只兜底一次） */
function guardImage(img, fallback) {
  img.onerror = () => {
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = fallback();
  };
}

export function createCardView(card = null, { faceUp = false } = {}) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = [
    '<div class="card-face card-front"><img alt=""></div>',
    '<div class="card-face card-back"><img alt=""></div>',
  ].join('');

  const frontImg = el.querySelector('.card-front img');
  const backImg = el.querySelector('.card-back img');
  backImg.src = catalog.backUrl();
  guardImage(backImg, () => plainBack());

  const view = {
    el,
    card,

    setCard(next) {
      card = next;
      view.card = next;
      if (next) {
        guardImage(frontImg, () => plainFace(next));
        frontImg.src = catalog.faceUrl(next);
        frontImg.alt = cardText(next);
        el.dataset.uid = next.uid;
      } else {
        frontImg.removeAttribute('src');
        frontImg.alt = '';
        delete el.dataset.uid;
      }
      return view;
    },

    setFaceUp(value) {
      el.classList.toggle('is-faceup', Boolean(value));
      return view;
    },

    setSelected(value) {
      el.classList.toggle('is-selected', Boolean(value));
      return view;
    },

    /** 层级：统一由 CSS 变量分档，避免到处写死 z-index */
    setLayer(layer, index = 0) {
      el.style.setProperty('--z', String(layer * 1000 + index));
      return view;
    },

    setIndex(index) {
      el.style.setProperty('--i', String(index));
      return view;
    },

    attachTo(host) {
      host.appendChild(el);
      return view;
    },

    remove() {
      el.remove();
    },
  };

  if (card) view.setCard(card);
  view.setFaceUp(faceUp);
  return view;
}
