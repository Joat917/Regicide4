/**
 * 事件 → 人话（纯字符串）
 */

import { EVENT } from '../engine/constants.js';
import { cardText, cardsText, SUIT_NAME } from './cardText.js';

export function describeEvent(ev) {
  switch (ev.kind) {
    case EVENT.PLAY:
      return `打出 ${cardsText(ev.cards)}`;
    case EVENT.SUIT_HEART:
      return `♥红桃：洗混弃牌堆，${ev.amount} 张放回酒馆牌堆底部`;
    case EVENT.SUIT_DIAMOND:
      return `♦方块：抽了 ${ev.amount} 张牌`;
    case EVENT.SUIT_SPADE:
      return `♠黑桃：敌人攻击力 −${ev.amount}（持续到它被击败）`;
    case EVENT.SUIT_CLUB:
      return `♣梅花：本次伤害翻倍 → ${ev.amount}`;
    case EVENT.SUIT_BLOCKED:
      return `${SUIT_NAME[ev.suit] ?? ev.suit} 能力被同花色免疫挡下`;
    case EVENT.DAMAGE:
      return `对 ${cardText(ev.card)} 造成 ${ev.amount} 点伤害`;
    case EVENT.DEFEAT:
      return `${cardText(ev.card)} 被击败，进入弃牌堆`;
    case EVENT.DEFEAT_EXACT:
      return `精确击杀！${cardText(ev.card)} 面朝下放到酒馆牌堆顶`;
    case EVENT.NEW_ENEMY:
      return `新的敌人 ${cardText(ev.card)}，由你继续行动`;
    case EVENT.COUNTERATTACK:
      return `${cardText(ev.card)} 反击：需要弃掉合计 ≥ ${ev.amount} 点`;
    case EVENT.DAMAGE_PAID:
      return ev.cards.length
        ? `弃掉 ${cardsText(ev.cards)}（${ev.amount} 点）挡下反击`
        : '本次没有伤害需要承受';
    case EVENT.JESTER_REFILL:
      return `小丑能力：弃掉 ${ev.cards.length} 张手牌，补抽 ${ev.amount} 张`;
    case EVENT.WIN:
      return '最后一名王族倒下 —— 胜利！';
    case EVENT.LOSE:
      return '无法继续抵抗 —— 失败';
    default:
      return String(ev.kind);
  }
}

export function describeEvents(events) {
  return events.map(describeEvent);
}
