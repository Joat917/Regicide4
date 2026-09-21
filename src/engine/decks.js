/**
 * 牌堆：城堡（敌人）、酒馆（抽牌）、弃牌
 *
 * 约定：数组**末尾是牌堆顶**（下一张会被抽到/翻到），开头是牌堆底。
 * 这个约定贯穿整个引擎：draw() = pop()，放到底 = unshift，放到顶 = push。
 */

import { NUMBER_RANKS, SUITS } from './constants.js';
import { createCard } from './card.js';
import { shuffle } from './prng.js';

export class Deck {
  constructor(cards = []) {
    this.cards = [...cards];
  }

  get count() {
    return this.cards.length;
  }

  get top() {
    return this.cards.length ? this.cards[this.cards.length - 1] : null;
  }

  get bottom() {
    return this.cards.length ? this.cards[0] : null;
  }

  draw() {
    return this.cards.length ? this.cards.pop() : null;
  }

  /** 放到牌堆底部（红桃回收用） */
  addToBottom(cards) {
    const list = Array.isArray(cards) ? cards : [cards];
    this.cards.unshift(...list);
  }

  /** 放到牌堆顶部（精确击杀的敌人、弃牌都用这个） */
  addToTop(cards) {
    const list = Array.isArray(cards) ? cards : [cards];
    this.cards.push(...list);
  }

  shuffle(rng) {
    shuffle(this.cards, rng);
    return this;
  }

  /** 拷贝一份（给测试和界面看，改它不影响牌堆） */
  toArray() {
    return [...this.cards];
  }
}

/** 酒馆牌堆：A + 2..10 各四门，共 40 张，洗匀 */
export function createTavernDeck(rng) {
  const cards = [];
  for (const suit of SUITS) {
    cards.push(createCard(suit, 'A'));
    for (const rank of NUMBER_RANKS) cards.push(createCard(suit, rank));
  }
  return new Deck(shuffle(cards, rng));
}

/** 城堡牌堆：K 在底、Q 在中、J 在顶（每等内部洗匀） */
export function createCastleDeck(rng) {
  const cards = [];
  for (const rank of ['K', 'Q', 'J']) {
    const group = SUITS.map((suit) => createCard(suit, rank));
    cards.push(...shuffle(group, rng));
  }
  return new Deck(cards);
}
