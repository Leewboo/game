"""简单 AI 决策

策略概述（身份驱动 + 贪心）：
- 行动优先级：低血量优先回桃 → 装备 → 对最弱敌人出杀 → 出锦囊 → 结束
- 目标选择：按身份计算敌意值（主忠打反/内；反打主/忠；内打血最少的非自己）
- 防御：被杀必出闪（除非没闪）；AOE 出响应牌的概率较高
- 求桃：仅当自己或同阵营玩家濒死且血量过低时出桃救

返回与 UI 一致的 Action 对象，方便统一接口。
"""

import random
from typing import Optional, List

from .player import (Player, IDENTITY_LORD, IDENTITY_LOYAL,
                     IDENTITY_REBEL, IDENTITY_SPY)
from .card import Card
from .action import Action


def _ally(self_id: str, other_id: str) -> bool:
    """身份阵营判定（粗略）"""
    if self_id == other_id:
        return True
    lord_camp = {IDENTITY_LORD, IDENTITY_LOYAL}
    rebel_camp = {IDENTITY_REBEL}
    spy_camp = {IDENTITY_SPY}
    if self_id in lord_camp and other_id in lord_camp:
        return True
    if self_id in rebel_camp and other_id in rebel_camp:
        return True
    return False  # 内奸独立阵营


def _is_enemy(self_id: str, other_id: str) -> bool:
    if self_id == other_id:
        return False
    lord_camp = {IDENTITY_LORD, IDENTITY_LOYAL}
    if self_id in lord_camp:
        return other_id in {IDENTITY_REBEL, IDENTITY_SPY}
    if self_id == IDENTITY_REBEL:
        return other_id in lord_camp
    # 内奸：所有非自己都是"敌人"（但优先弱者）
    return True


class AI:
    def __init__(self, game, ui):
        self.game = game
        self.ui = ui

    # =========================================================================
    # 出牌阶段决策
    # =========================================================================
    def decide_action(self, player: Player):
        # 1. 低血量优先用桃
        if player.hp <= 2 and player.hp < player.max_hp:
            ev = self.game.bus.emit("query_play_sources",
                                    player=player, target_type="桃", sources=[])
            for card, as_type in ev["sources"]:
                return Action(kind="play", card=card, target=player, as_type=as_type)

        # 2. 装备
        for c in list(player.hand):
            if c.type == "equipment":
                return Action(kind="play", card=c, target=None, as_type=c.name)

        # 3. 找最弱敌人
        target = self._pick_target(player)
        if target is not None:
            # 出杀（实际杀牌 + 武圣/龙胆转化）
            ev = self.game.bus.emit("query_play_sources",
                                    player=player, target_type="杀", sources=[])
            kill_limit_ev = self.game.bus.emit("query_kill_limit",
                                               player=player, limit=1)
            limit = kill_limit_ev["limit"]
            if self.game.kill_count_this_turn < limit and ev["sources"]:
                # 连弩下尽量多出
                card, as_type = ev["sources"][0]
                if self.game.in_attack_range(player, target):
                    return Action(kind="play", card=card,
                                          target=target, as_type=as_type)

            # 出锦囊（无中生有/决斗/AOE）
            for c in list(player.hand):
                if c.name == "无中生有" and len(player.hand) <= 4:
                    return Action(kind="play", card=c, target=None,
                                           as_type="无中生有")
                if c.name == "南蛮入侵" or c.name == "万箭齐发":
                    # 至少打到 1 个敌人时才用
                    enemies = [p for p in self.game.alive_players()
                               if p is not player and _is_enemy(player.identity, p.identity)]
                    if enemies:
                        return Action(kind="play", card=c, target=None,
                                               as_type=c.name)
                if c.name == "决斗" and target is not None:
                    return Action(kind="play", card=c, target=target,
                                           as_type="决斗")
                if c.name == "过河拆桥" and target is not None and target.hand:
                    return Action(kind="play", card=c, target=target,
                                           as_type="过河拆桥")
                if c.name == "顺手牵羊" and target is not None and target.hand:
                    if self.game.distance(player, target) <= 1:
                        return Action(kind="play", card=c, target=target,
                                               as_type="顺手牵羊")

        # 4. 无事可做
        return Action(kind="end", card=None, target=None)

    def _pick_target(self, player: Player) -> Optional[Player]:
        """挑选攻击范围内血最少的敌人"""
        candidates = []
        for p in self.game.alive_players():
            if p is player:
                continue
            if not _is_enemy(player.identity, p.identity):
                continue
            if self.game.in_attack_range(player, p):
                candidates.append(p)
        if not candidates:
            return None
        # 血最少优先
        candidates.sort(key=lambda x: (x.hp, random.random()))
        return candidates[0]

    # =========================================================================
    # 被动响应（出闪 / 决斗出杀 / AOE 出牌 / 出桃救人）
    # =========================================================================
    def decide_response(self, player, source, response_type, sources, reason=""):
        """sources 是 [(card, as_type)] 列表"""
        if not sources:
            return None
        # 被杀：必出闪（除非剩牌少且血量充足想保留）
        if reason == "dodge":
            if player.hp <= 2 or len(sources) >= 2:
                return random.choice(sources)
            # 血量充足时 70% 出闪
            if random.random() < 0.7:
                return random.choice(sources)
            return None
        if reason == "aoe":
            # AOE 必出响应牌（避免掉血）
            if player.hp <= 2 or random.random() < 0.8:
                return random.choice(sources)
            return None
        if reason == "duel":
            # 决斗：有杀就出（避免掉血），剩少时考虑保留
            if player.hp <= 2 or random.random() < 0.6:
                return random.choice(sources)
            return None
        return random.choice(sources)

    def decide_save(self, savior, dying, sources):
        """是否出桃救 dying"""
        if not sources:
            return None
        # 救自己
        if savior is dying:
            return sources[0]
        # 救同阵营（仅当 dying 是同阵营）
        if _ally(savior.identity, dying.identity):
            return sources[0]
        # 内奸：剩 1-2 玩家时考虑救以平衡局面
        if savior.identity == IDENTITY_SPY:
            alive = self.game.alive_players()
            if len(alive) <= 3 and random.random() < 0.5:
                return sources[0]
        return None

    # =========================================================================
    # 弃牌选择
    # =========================================================================
    def choose_discard(self, player, count):
        """优先弃低价值牌：闪 < 桃 < 杀 < 锦囊 < 装备"""
        priority = {"闪": 1, "桃": 2, "杀": 3, "无中生有": 4,
                    "决斗": 4, "南蛮入侵": 4, "万箭齐发": 4,
                    "过河拆桥": 4, "顺手牵羊": 4, "借刀杀人": 4}
        sorted_hand = sorted(player.hand,
                             key=lambda c: priority.get(c.name, 5))
        return sorted_hand[:count]

    # =========================================================================
    # 借刀杀人（target 视角）
    # =========================================================================
    def ask_jie_dao(self, target, source, candidates):
        """target 是否对某候选玩家出杀"""
        # 简单策略：对候选中的最弱敌人出杀
        ev = self.game.bus.emit("query_play_sources",
                                player=target, target_type="杀", sources=[])
        if not ev["sources"]:
            return None, None
        # 找最弱敌人作为目标
        cand_sorted = sorted(candidates, key=lambda x: x.hp)
        target_player = cand_sorted[0]
        # 出杀概率 70%（否则交武器）
        if random.random() < 0.7:
            card, as_type = ev["sources"][0]
            return target_player, card
        return None, None
