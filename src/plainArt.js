/**
 * 内置"简易牌面"：不依赖任何图片文件，直接在运行时拼 SVG 字符串、转成 data URL。
 *
 * 为什么需要它：本仓库**不分发美术资源**（版权原因，见 ../THIRD-PARTY.md），
 * 如果只靠 `assets/` 里的图，别人克隆下来就完全玩不了。
 * 所以 assetCatalog 在找不到 `assets/manifest.json` 时会自动切到这一套——
 * **零资源也能玩**，只是不好看。
 *
 * 设计取向：够用的扑克牌观感（白底 + 角标点数 + 花色 + 中央淡花色），
 * 花色用**矢量路径**画（不依赖系统有没有 ♠♥♦♣ 字形），只有点数用文字。
 * 想换成自己的风格，改这一个文件即可。
 */

const RED = '#b3261e';
const DARK = '#1a0903';
const CARD_W = 500;
const CARD_H = 700; // 5:7，与 CSS 的 --card-h = --card-w × 1.3989 一致
const FONT = "Georgia, 'Times New Roman', serif";

const SUIT_COLOR = { C: DARK, D: RED, H: RED, S: DARK };

const dataUrl = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;

/** 在 0..100 的方框里画一个花色（矢量，不依赖字体） */
function suitShapes(suit, color) {
  const fill = `fill="${color}"`;
  switch (suit) {
    case 'D':
      return `<path d="M50 3 L97 50 L50 97 L3 50 Z" ${fill}/>`;
    case 'H':
      return `<path d="M50 92 C14 64 4 46 4 32 C4 17 15 6 29 6 C38 6 46 11 50 20 C54 11 62 6 71 6 C85 6 96 17 96 32 C96 46 86 64 50 92 Z" ${fill}/>`;
    case 'S':
      return (
        `<path d="M50 6 C50 6 10 44 10 64 C10 77 20 86 32 86 C39 86 45 83 50 77 ` +
        `C55 83 61 86 68 86 C80 86 90 77 90 64 C90 44 50 6 50 6 Z" ${fill}/>` +
        `<rect x="43" y="76" width="14" height="22" rx="6" ${fill}/>`
      );
    default: // 'C'
      return (
        `<circle cx="50" cy="28" r="23" ${fill}/>` +
        `<circle cx="26" cy="64" r="23" ${fill}/>` +
        `<circle cx="74" cy="64" r="23" ${fill}/>` +
        `<rect x="43" y="60" width="14" height="36" rx="6" ${fill}/>`
      );
  }
}

/** 角标：点数在上、花色在下（原点在牌面左上角内侧） */
function cornerMarkup(rank, suit, color) {
  const symbol = suit
    ? `<g transform="translate(26 122) scale(0.52)">${suitShapes(suit, color)}</g>`
    : '';
  return (
    `<text x="28" y="96" font-family="${FONT}" font-size="92" font-weight="700" fill="${color}">${rank}</text>` +
    symbol
  );
}

/**
 * 一张牌的正面。
 * @param {{rank: string, suit: string|null, isJoker?: boolean}} card
 */
export function plainFace(card) {
  const isJoker = Boolean(card?.isJoker);
  const rank = isJoker ? '★' : (card?.rank ?? '?');
  const suit = isJoker ? null : card?.suit;
  const color = isJoker ? DARK : (SUIT_COLOR[suit] ?? DARK);

  const corner = cornerMarkup(rank, suit, color);
  const center = suit
    ? `<g transform="translate(250 350) scale(2.3) translate(-50 -50)" opacity="0.12">${suitShapes(suit, color)}</g>`
    : `<text x="250" y="440" font-family="${FONT}" font-size="240" text-anchor="middle" fill="${color}" opacity="0.12">★</text>`;

  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">` +
      `<rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>` +
      center +
      corner +
      `<g transform="rotate(180 250 350)">${corner}</g>` +
      `</svg>`,
  );
}

/** 牌背 */
export function plainBack() {
  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">` +
      `<defs><pattern id="lattice" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<path d="M0 0 H44" stroke="#c8a349" stroke-width="1.6" opacity="0.35"/>` +
      `</pattern></defs>` +
      `<rect width="${CARD_W}" height="${CARD_H}" fill="#312a44"/>` +
      `<rect x="34" y="34" width="432" height="632" rx="14" fill="url(#lattice)"/>` +
      `<rect x="18" y="18" width="464" height="664" rx="18" fill="none" stroke="#c8a349" stroke-width="5"/>` +
      `<rect x="34" y="34" width="432" height="632" rx="14" fill="none" stroke="#c8a349" stroke-width="2" opacity="0.7"/>` +
      `</svg>`,
  );
}

/**
 * 徽章上的一位数字（牌堆计数、攻击力、生命值都用它拼两位数）
 * @param {number} value 0..9
 * @param {'num'|'rnum'} kind num = 深色，rnum = 红色（沿用原美术的约定）
 */
export function plainDigit(value, kind = 'num') {
  const color = kind === 'rnum' ? RED : DARK;
  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66 100" width="66" height="100">` +
      `<text x="33" y="80" font-family="${FONT}" font-size="92" font-weight="700" text-anchor="middle" fill="${color}">${value}</text>` +
      `</svg>`,
  );
}

/** 花色图标（Boss 徽章、已选牌提示用） */
export function plainSuitIcon(suit) {
  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
      suitShapes(suit, SUIT_COLOR[suit] ?? DARK) +
      `</svg>`,
  );
}

export const PLAIN_CARD_SIZE = { w: CARD_W, h: CARD_H };
