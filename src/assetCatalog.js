/**
 * 资源目录：前端访问美术资源的**唯一入口**
 *
 * 启动时读 assets/manifest.json（由 web/tools/assets.mjs 生成），
 * 之后所有图片路径都经过这里。任何地方都不许手拼 "Front (13).png"。
 *
 * 两种模式：
 *   'file'  —— 用 assets/ 里的图片（有 manifest.json 时）
 *   'plain' —— 找不到资源时退回 src/plainArt.js 生成的矢量牌面（**零资源也能玩**）
 * 想换美术资源见 web/ART.md；手工拷贝（保留原名）时把 URL_STYLE 改成 'original'。
 */

import {
  PLAIN_CARD_SIZE,
  plainBack,
  plainDigit,
  plainFace,
  plainSuitIcon,
} from './plainArt.js';

export const URL_STYLE = 'renamed'; // 'renamed' | 'original'

/** 花色编号：0=♣ 1=♦ 2=♥ 3=♠（与 content.js 的 PowerList 一致） */
const SUIT_INDEX = Object.freeze({ C: 0, D: 1, H: 2, S: 3 });

/**
 * 与 regicideHQ 的资源编号对齐（**不是**点数大小的顺序！）
 *
 * 出处：regicideHQ/js/content.js 的 initPile()
 *     drawPile.push(i + 13 * j)     // i ∈ [1,10] → A,2,…,10
 *     tmpPile.push(i + 13 * j)      // i ∈ [11,13] → J,Q,K
 * 所以每个花色块内 13 张的顺序是 A,2,3,…,10,J,Q,K：
 *     imageNumber = 13 * suitIndex + rankOffset + 1     rankOffset: A=0 … K=12
 *
 * ⚠ 千万别和 content.js 里 pointCount() / 出牌判断用的 `id % 13`
 *   （0=K、1=A、2..10、11=J、12=Q）混为一谈——那是"算数值"的算术，
 *   不是资源编号；两者相差一位，搞混就会让整副牌的画面错位一张。
 */
const RANK_OFFSET = Object.freeze({
  A: 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  '10': 9,
  J: 10,
  Q: 11,
  K: 12,
});

const SUIT_ICON_FILE = Object.freeze({
  C: 'icon-club.png',
  D: 'icon-diamond.png',
  H: 'icon-heart.png',
  S: 'icon-spade.png',
});

const pad2 = (n) => String(n).padStart(2, '0');

/** 卡牌 → 资源编号（1..52；小丑用 53）  imageNumber = 13 * suitIndex + rankOffset + 1 */
export function assetIdOf(card) {
  if (!card || card.isJoker) return 53;
  return 13 * SUIT_INDEX[card.suit] + RANK_OFFSET[card.rank] + 1;
}

export const catalog = {
  base: 'assets/',
  manifest: null,
  /** 'file' = 用 assets/ 里的图片；'plain' = 用内置简易牌面（零资源） */
  mode: 'file',
  /** 读取 manifest 失败时的原因（切到 plain 模式后仍保留，供界面提示） */
  loadError: null,

  /**
   * 读取 manifest.json；base 默认 'assets/'（相对于当前页面）。
   *
   * @param {string} base
   * @param {{plainFallback?: boolean}} [options]
   *   plainFallback=true（默认）：读不到就自动切到内置简易牌面，**不抛错**，
   *   这样没有美术资源的人克隆下来也能直接玩（界面会提示"简易牌面"）。
   *   plainFallback=false：抛错（`?art=file` 时用它，方便排查资源问题）。
   */
  async load(base = 'assets/', { plainFallback = true } = {}) {
    this.base = base.endsWith('/') ? base : `${base}/`;
    const url = `${this.base}manifest.json`;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.manifest = await res.json();
      this.mode = 'file';
      this.loadError = null;
    } catch (err) {
      if (!plainFallback) {
        throw new Error(
          `读取 ${url} 失败（${err.message}）。是否忘了先跑 "node web/tools/assets.mjs"？`,
        );
      }
      this.manifest = null;
      this.mode = 'plain';
      this.loadError = err.message;
    }
    return this.manifest;
  },

  /** 强制使用内置简易牌面（`?art=plain`） */
  usePlainArt() {
    this.mode = 'plain';
  },

  get usesPlainArt() {
    return this.mode === 'plain';
  },

  get ready() {
    return Boolean(this.manifest);
  },

  faceUrl(card) {
    if (this.mode === 'plain') return plainFace(card);
    return this.faceUrlById(assetIdOf(card));
  },

  faceUrlById(id) {
    const entry = this.manifest?.cards?.[String(id)];
    if (entry?.file) return this.base + entry.file;
    if (URL_STYLE === 'original') {
      return `${this.base}cards/${encodeURIComponent(`Front (${id}).png`)}`;
    }
    return `${this.base}cards/card-${pad2(id)}.png`;
  },

  backUrl() {
    if (this.mode === 'plain') return plainBack();
    const file = this.manifest?.back?.file;
    return this.base + (file ?? 'cards/back.png');
  },

  /** kind: 'num' | 'rnum' */
  iconUrl(kind, index) {
    if (this.mode === 'plain') return plainDigit(index, kind);
    const file = this.manifest?.icons?.[kind]?.[index];
    return this.base + (file ?? `icons/${kind}-${index}.png`);
  },

  suitIconUrl(suit) {
    if (this.mode === 'plain') return plainSuitIcon(suit);
    const file = this.manifest?.icons?.suit?.[suit];
    return this.base + (file ?? `icons/${SUIT_ICON_FILE[suit]}`);
  },

  /** manifest 里那张牌的原始信息（花色/点数/数值/真实像素尺寸） */
  info(id) {
    return this.manifest?.cards?.[String(id)] ?? null;
  },

  /** 牌面图片的真实像素尺寸（manifest 里由资源脚本写入；简易牌面是固定的 5:7） */
  cardSize() {
    if (this.mode === 'plain') return { ...PLAIN_CARD_SIZE };
    const entry = this.info(1);
    return { w: entry?.w ?? 0, h: entry?.h ?? 0 };
  },

  /** 调试页用：把 1..54 的资源逐条列出来 */
  listCards() {
    const out = [];
    const ids = [...Array(54)].map((_, i) => i + 1);
    for (const id of ids) out.push({ id, ...(this.info(id) ?? {}) });
    return out;
  },
};
