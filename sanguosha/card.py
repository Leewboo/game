"""卡牌系统

Card 是单张牌的数据对象；花色 / 点数 / 名称 / 类型 / 子类型 / 效果关键字 / 额外数据。
扩展新卡牌只需在 build_standard_deck() 里 append 一行。
"""

import random
from dataclasses import dataclass, field
from typing import List


SUITS = ["♠", "♥", "♣", "♦"]
RED_SUITS = {"♥", "♦"}
BLACK_SUITS = {"♠", "♣"}

# ANSI 着色
C_RED = "\033[31m"
C_DARK = "\033[90m"
C_RESET = "\033[0m"
C_BOLD = "\033[1m"


def rank_to_value(r: str) -> int:
    if r == "A":
        return 1
    if r == "J":
        return 11
    if r == "Q":
        return 12
    if r == "K":
        return 13
    return int(r)


@dataclass
class Card:
    suit: str               # ♠ ♥ ♣ ♦
    rank: str               # 'A','2'...'K'
    name: str               # 杀 / 闪 / 桃 / 无中生有 / ...
    type: str               # basic / trick / equipment
    subtype: str = ""       # equipment 子类型: weapon/armor/plus_horse/minus_horse
    effect: str = ""        # 装备效果关键字: zhuge / bagua / qinggang / dilu / chitu
    value: int = 0          # 点数大小
    data: dict = field(default_factory=dict)  # 额外数据（如武器射程）

    @property
    def color(self) -> str:
        return "red" if self.suit in RED_SUITS else "black"

    @property
    def display(self) -> str:
        """带 ANSI 颜色的展示"""
        c = C_RED if self.suit in RED_SUITS else C_DARK
        return f"{c}{self.suit}{self.rank}{self.name}{C_RESET}"

    @property
    def plain(self) -> str:
        """不带色，用于日志"""
        return f"{self.suit}{self.rank}{self.name}"

    def __repr__(self):
        return self.plain


def make_card(suit, rank, name, type="basic", subtype="", effect="", **kw) -> Card:
    return Card(suit, rank, name, type, subtype, effect, rank_to_value(rank), dict(kw))


# ---------------------------------------------------------------------------
# 标准牌堆（简化版，可自行扩充）
# ---------------------------------------------------------------------------
def build_standard_deck() -> List[Card]:
    """构建一副简化版三国杀牌堆

    数量大致遵循经典版：杀 24 / 闪 15 / 桃 12 / 锦囊若干 / 装备若干
    花色点数有少量重复（简化处理），不影响游戏体验
    """
    cards: List[Card] = []

    def add(s, r, name, t="basic", sub="", eff="", **kw):
        cards.append(make_card(s, r, name, t, sub, eff, **kw))

    # === 基本牌 ===
    # 杀（黑色为主，混入红杀）
    for s, r in [
        ("♠", "A"), ("♠", "7"), ("♠", "8"), ("♠", "9"), ("♠", "10"),
        ("♠", "J"), ("♠", "Q"), ("♠", "K"),
        ("♣", "7"), ("♣", "8"), ("♣", "9"), ("♣", "10"),
        ("♣", "J"), ("♣", "Q"), ("♣", "K"),
        ("♦", "7"), ("♦", "8"), ("♦", "9"), ("♦", "10"),
        ("♦", "J"),
        ("♥", "10"), ("♥", "J"), ("♥", "Q"), ("♥", "K"),
    ]:
        add(s, r, "杀")
    # 闪
    for s, r in [
        ("♥", "2"), ("♥", "3"), ("♥", "4"), ("♥", "5"), ("♥", "6"),
        ("♦", "2"), ("♦", "3"), ("♦", "4"), ("♦", "5"), ("♦", "6"),
        ("♦", "8"), ("♦", "9"),
        ("♥", "7"), ("♥", "8"), ("♥", "9"),
    ]:
        add(s, r, "闪")
    # 桃
    for s, r in [
        ("♥", "5"), ("♥", "6"), ("♥", "7"), ("♥", "8"), ("♥", "9"),
        ("♥", "A"), ("♥", "Q"),
        ("♦", "3"), ("♦", "4"), ("♦", "Q"), ("♦", "K"), ("♦", "A"),
    ]:
        add(s, r, "桃")

    # === 锦囊 ===
    add("♥", "10", "无中生有", "trick")
    add("♥", "J", "无中生有", "trick")
    add("♥", "Q", "无中生有", "trick")
    add("♦", "5", "无中生有", "trick")
    add("♠", "A", "决斗", "trick")
    add("♣", "A", "决斗", "trick")
    add("♠", "K", "南蛮入侵", "trick")
    add("♣", "K", "南蛮入侵", "trick")
    add("♥", "A", "万箭齐发", "trick")
    add("♦", "A", "万箭齐发", "trick")
    add("♥", "5", "桃园结义", "trick")
    add("♣", "5", "桃园结义", "trick")
    add("♠", "J", "无懈可击", "trick")
    add("♣", "J", "无懈可击", "trick")
    add("♠", "Q", "借刀杀人", "trick")
    add("♣", "Q", "借刀杀人", "trick")
    add("♠", "3", "过河拆桥", "trick")
    add("♣", "3", "过河拆桥", "trick")
    add("♠", "4", "顺手牵羊", "trick")
    add("♣", "4", "顺手牵羊", "trick")

    # === 装备 ===
    # 武器
    add("♦", "A", "诸葛连弩", "equipment", "weapon", "zhuge", range=1)
    add("♣", "A", "诸葛连弩", "equipment", "weapon", "zhuge", range=1)
    add("♠", "5", "青釭剑", "equipment", "weapon", "qinggang", range=2)
    add("♠", "6", "青釭剑", "equipment", "weapon", "qinggang", range=2)
    add("♦", "5", "贯石斧", "equipment", "weapon", "guanshi", range=3)
    add("♣", "5", "贯石斧", "equipment", "weapon", "guanshi", range=3)
    # 防具
    add("♠", "2", "八卦阵", "equipment", "armor", "bagua")
    add("♣", "2", "八卦阵", "equipment", "armor", "bagua")
    # +1 马（防御马）
    add("♥", "5", "的卢", "equipment", "plus_horse", "dilu")
    add("♣", "5", "的卢", "equipment", "plus_horse", "dilu")
    # -1 马（进攻马）
    add("♥", "K", "赤兔", "equipment", "minus_horse", "chitu")
    add("♦", "K", "赤兔", "equipment", "minus_horse", "chitu")

    return cards


class Deck:
    """牌堆 + 弃牌堆，统一管理摸/弃/洗"""

    def __init__(self, cards: List[Card]):
        self.draw_pile: List[Card] = list(cards)
        self.discard_pile: List[Card] = []
        self.shuffle()

    def shuffle(self):
        random.shuffle(self.draw_pile)

    def draw(self, n=1) -> List[Card]:
        drawn = []
        for _ in range(n):
            if not self.draw_pile:
                # 重洗弃牌堆
                self.draw_pile = self.discard_pile
                self.discard_pile = []
                self.shuffle()
                if not self.draw_pile:
                    break
            drawn.append(self.draw_pile.pop())
        return drawn

    def discard(self, card: Card):
        self.discard_pile.append(card)

    def peek(self, n=1) -> List[Card]:
        """查看牌堆顶 N 张（不摸走），用于观星"""
        return self.draw_pile[-n:] if n <= len(self.draw_pile) else list(self.draw_pile)

    def reorder_top(self, cards: List[Card]):
        """将给定牌按顺序放回牌堆顶（cards 末元素为最顶）"""
        # 先从 draw_pile 移除这些牌
        for c in cards:
            if c in self.draw_pile:
                self.draw_pile.remove(c)
        # 再按顺序压回（最后一张放最顶）
        for c in cards:
            self.draw_pile.append(c)
