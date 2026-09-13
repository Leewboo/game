"""标准武将集合

每个武将 = General 子类 + 一组 Skill 子类。
所有技能都通过事件总线介入游戏；这里覆盖了几种常见技能模式：

1. 武圣（关羽）：把红手牌当杀 → 订阅 query_play_sources
2. 龙胆（赵云）：杀 ↔ 闪互换 → 同上
3. 咆哮（张飞）：出杀无次数限制 → 订阅 query_kill_limit
4. 仁德（刘备）：给牌换血 → 订阅 cards_given
5. 反馈（司马懿）：受伤害后摸来源一张牌 → 订阅 damage（后置）
6. 天妒（郭嘉）：受伤害后摸 2 张 → 订阅 damage（后置）
"""

import random

from ..general import General, register_general
from ..skill import Skill


# =========================================================================
# 关羽
# =========================================================================
class WuSheng(Skill):
    """武圣：红色手牌可当杀使用或打出"""
    name = "武圣"
    description = "红色手牌可当杀使用或打出"

    def subscribe(self, bus):
        bus.subscribe("query_play_sources", self.on_query)

    def on_query(self, ev):
        if ev["player"] is self.owner and ev["target_type"] == "杀":
            for c in list(self.owner.hand):
                if c.color == "red" and c.name != "杀":
                    if not any(s[0] is c for s in ev["sources"]):
                        ev["sources"].append((c, "杀"))


@register_general
class GuanYu(General):
    name = "关羽"
    max_hp = 4
    skill_classes = [WuSheng]


# =========================================================================
# 赵云
# =========================================================================
class LongDan(Skill):
    """龙胆：杀可当闪，闪可当杀"""
    name = "龙胆"
    description = "杀可当闪，闪可当杀"

    def subscribe(self, bus):
        bus.subscribe("query_play_sources", self.on_query)

    def on_query(self, ev):
        if ev["player"] is not self.owner:
            return
        tt = ev["target_type"]
        if tt == "杀":
            for c in list(self.owner.hand):
                if c.name == "闪":
                    if not any(s[0] is c for s in ev["sources"]):
                        ev["sources"].append((c, "杀"))
        elif tt == "闪":
            for c in list(self.owner.hand):
                if c.name == "杀":
                    if not any(s[0] is c for s in ev["sources"]):
                        ev["sources"].append((c, "闪"))


@register_general
class ZhaoYun(General):
    name = "赵云"
    max_hp = 4
    skill_classes = [LongDan]


# =========================================================================
# 张飞
# =========================================================================
class PaoXiao(Skill):
    """咆哮：出牌阶段可出任意张杀"""
    name = "咆哮"
    description = "出牌阶段可出任意张杀"

    def subscribe(self, bus):
        bus.subscribe("query_kill_limit", self.on_limit)

    def on_limit(self, ev):
        if ev["player"] is self.owner:
            ev["limit"] = 999


@register_general
class ZhangFei(General):
    name = "张飞"
    max_hp = 4
    skill_classes = [PaoXiao]


# =========================================================================
# 刘备
# =========================================================================
class RenDe(Skill):
    """仁德：给出至少 2 张手牌时回复 1 体力（每回合限 1 次）"""
    name = "仁德"
    description = "出牌阶段可任意给牌；给出至少 2 张时回复 1 体力（每回合限 1 次）"

    def __init__(self):
        super().__init__()
        self.used_this_turn = False

    def subscribe(self, bus):
        bus.subscribe("turn_start", self.on_turn_start)
        bus.subscribe("cards_given", self.on_given)

    def on_turn_start(self, ev):
        if ev["player"] is self.owner:
            self.used_this_turn = False

    def on_given(self, ev):
        if ev["source"] is self.owner and not self.used_this_turn:
            if len(ev["cards"]) >= 2 and self.owner.hp < self.owner.max_hp:
                self.owner.hp += 1
                self.used_this_turn = True
                print(f"  {self.owner.name}【仁德】回复 1 体力 -> {self.owner.hp}/{self.owner.max_hp}")


@register_general
class LiuBei(General):
    name = "刘备"
    max_hp = 4
    skill_classes = [RenDe]


# =========================================================================
# 司马懿
# =========================================================================
class FanKui(Skill):
    """反馈：受到伤害后获得来源一张牌（手牌优先，无则装备）"""
    name = "反馈"
    description = "受到伤害后，获得来源一张牌"

    def subscribe(self, bus):
        bus.subscribe("damage", self.on_damage)

    def on_damage(self, ev):
        target = ev["target"]
        source = ev["source"]
        if target is not self.owner or source is None:
            return
        # 摸来源一张牌：优先手牌
        if source.hand:
            card = random.choice(source.hand)
            source.hand.remove(card)
            self.owner.hand.append(card)
            print(f"  {self.owner.name}【反馈】获得 {source.name} 的 {card.plain}")
        else:
            for slot in ("weapon", "armor", "plus_horse", "minus_horse"):
                if source.equipment[slot]:
                    card = source.equipment[slot]
                    source.equipment[slot] = None
                    self.owner.hand.append(card)
                    print(f"  {self.owner.name}【反馈】获得 {source.name} 的 {card.plain}")
                    break


@register_general
class SimaYi(General):
    name = "司马懿"
    max_hp = 3
    skill_classes = [FanKui]


# =========================================================================
# 郭嘉
# =========================================================================
class TianDu(Skill):
    """天妒：受到伤害后摸 2 张牌"""
    name = "天妒"
    description = "受到伤害后，可摸 2 张牌"

    def subscribe(self, bus):
        bus.subscribe("damage", self.on_damage)

    def on_damage(self, ev):
        if ev["target"] is not self.owner:
            return
        if not self.owner.is_alive:
            return
        drawn = self.game.deck.draw(2)
        self.owner.hand.extend(drawn)
        print(f"  {self.owner.name}【天妒】摸 2 张牌")


@register_general
class GuoJia(General):
    name = "郭嘉"
    max_hp = 3
    skill_classes = [TianDu]
