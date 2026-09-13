"""游戏引擎 - 三国杀主流程

负责：身份分配、武将装配、回合（摸/出/弃阶段）、卡牌结算、伤害、
濒死求桃、距离与攻击范围、死亡翻面、胜负判定。

所有关键节点通过 self.bus.emit(...) 发出事件，技能可挂入修改。
"""

import random
from typing import List, Optional

from .event import EventBus
from .card import Deck, build_standard_deck, Card
from .player import Player, IDENTITY_LORD, IDENTITY_LOYAL, IDENTITY_REBEL, IDENTITY_SPY
from .general import General, load_generals, all_generals


class Game:
    def __init__(self, players: List[Player], ui):
        self.players = players
        self.ui = ui
        self.ui.game = self
        self.bus = EventBus()
        self.deck: Optional[Deck] = None
        self.current_idx = 0
        self.turn_count = 0
        self.game_over = False
        self.winner = None
        self.kill_count_this_turn = 0  # 当前回合出杀数（受咆哮/连弩影响）

    # =========================================================================
    # 准备阶段
    # =========================================================================
    def setup(self):
        # 1. 牌堆
        self.deck = Deck(build_standard_deck())

        # 2. 武将池加载（内置 + custom_generals/）
        load_generals()
        pool = all_generals()
        if not pool:
            raise RuntimeError("武将池为空：检查 generals/ 与 custom_generals/")

        # 3. 随机分配武将
        chosen = random.sample(pool, len(self.players))
        for p, gcls in zip(self.players, chosen):
            p.general = gcls()
            p.max_hp = p.general.max_hp
            if p.identity == IDENTITY_LORD:
                p.max_hp += 1  # 主公 +1 体力
            p.hp = p.max_hp
            # 实例化技能并 attach（传入 game 引用，便于技能摸牌/造成伤害）
            for scls in p.general.skill_classes:
                skill = scls()
                skill.attach(p, self.bus, self)
                p.skills.append(skill)

        # 4. 发初始手牌
        for p in self.players:
            p.hand.extend(self.deck.draw(4))

        self.ui.log("身份已暗中分配。主公身份公开，其他身份隐藏至死亡。")

    def assign_identities(self):
        """根据玩家人数分配身份（主忠反内）"""
        n = len(self.players)
        # 主公总是第一个玩家
        plan = [IDENTITY_LORD]
        if n == 2:
            plan = [IDENTITY_LORD, IDENTITY_REBEL]
        elif n == 3:
            plan = [IDENTITY_LORD, IDENTITY_REBEL, IDENTITY_REBEL]
        elif n == 4:
            plan = [IDENTITY_LORD, IDENTITY_LOYAL, IDENTITY_REBEL, IDENTITY_REBEL]
        elif n == 5:
            plan = [IDENTITY_LORD, IDENTITY_LOYAL, IDENTITY_REBEL, IDENTITY_REBEL, IDENTITY_SPY]
        elif n == 6:
            plan = [IDENTITY_LORD, IDENTITY_LOYAL, IDENTITY_REBEL, IDENTITY_REBEL, IDENTITY_REBEL, IDENTITY_SPY]
        elif n == 7:
            plan = [IDENTITY_LORD, IDENTITY_LOYAL, IDENTITY_LOYAL, IDENTITY_REBEL, IDENTITY_REBEL, IDENTITY_REBEL, IDENTITY_SPY]
        elif n == 8:
            plan = [IDENTITY_LORD, IDENTITY_LOYAL, IDENTITY_LOYAL, IDENTITY_REBEL, IDENTITY_REBEL, IDENTITY_REBEL, IDENTITY_REBEL, IDENTITY_SPY]
        else:
            # 自适应：1主 + (n-1)/2反 + 1忠 + 余下内
            plan = [IDENTITY_LORD] + [IDENTITY_REBEL] * ((n - 1) // 2) + [IDENTITY_LOYAL]
            while len(plan) < n:
                plan.append(IDENTITY_SPY)
        random.shuffle(plan[1:])  # 主公固定位置[0]
        # 但更标准是随机洗牌后找出主公位置；这里简化为主公=玩家1
        for p, idn in zip(self.players, plan):
            p.identity = idn

    # =========================================================================
    # 主循环
    # =========================================================================
    def start(self):
        self.assign_identities()
        self.setup()
        self.ui.show_start()
        while not self.game_over:
            p = self.players[self.current_idx]
            if p.is_alive:
                self.run_turn(p)
            if self.game_over:
                break
            self.current_idx = (self.current_idx + 1) % len(self.players)
        self.ui.show_end(self.winner)

    def alive_players(self) -> List[Player]:
        return [p for p in self.players if p.is_alive]

    # =========================================================================
    # 一个回合
    # =========================================================================
    def run_turn(self, player: Player):
        self.turn_count += 1
        self.kill_count_this_turn = 0
        self.ui.log(f"\n===== {player.name} 的回合开始 =====", important=True)

        self.bus.emit("turn_start", player=player)

        # 判定阶段：暂略（闪电/乐不思蜀未实现，留作拓展点）
        self.bus.emit("phase_judgment_start", player=player)

        # 摸牌阶段
        ev = self.bus.emit("phase_draw_start", player=player, count=2)
        drawn = self.deck.draw(ev["count"])
        player.hand.extend(drawn)
        self.ui.log(f"{player.name} 摸 {len(drawn)} 张牌")
        self.bus.emit("phase_draw_end", player=player, cards=drawn)

        # 出牌阶段
        self.bus.emit("phase_play_start", player=player)
        self.play_phase(player)
        self.bus.emit("phase_play_end", player=player)

        # 弃牌阶段
        self.discard_phase(player)

        self.bus.emit("turn_end", player=player)
        self.ui.log(f"----- {player.name} 回合结束 -----")

    def play_phase(self, player: Player):
        """循环询问玩家动作直到其选择结束"""
        while player.is_alive and not self.game_over:
            action = self.ui.get_action(player)
            if action is None or action.kind == "end":
                return
            if action.kind == "play":
                self.play_card(player, action.card, action.target, action.as_type)
            elif action.kind == "give":
                # 仁德等技能触发的"给牌"动作
                self.give_cards(player, action.target, action.cards)
            elif action.kind == "info":
                self.ui.show_player_info(action.target)

    def discard_phase(self, player: Player):
        # 计算需弃牌数（手牌上限 = 当前体力，最少为 0）
        limit = max(player.hp, 0)
        if player.has_equipment_effect("zhuge"):
            pass  # 连弩不影响弃牌
        excess = len(player.hand) - limit
        if excess <= 0:
            return
        ev = self.bus.emit("phase_discard_start", player=player, count=excess)
        count = ev["count"]
        self.ui.log(f"{player.name} 弃牌阶段需弃 {count} 张")
        to_discard = self.ui.choose_discard(player, count)
        for c in to_discard:
            player.hand.remove(c)
            self.deck.discard(c)
            self.ui.log(f"  弃 {c.plain}")

    # =========================================================================
    # 出牌结算
    # =========================================================================
    def play_card(self, source: Player, card: Card, target: Optional[Player], as_type: str = ""):
        """通用出牌入口

        source    出牌人
        card      实际手牌（可能是被技能当作另一类型用）
        target    目标（可空）
        as_type  当作何牌用（武圣红牌当杀 -> as_type='杀'）
        """
        as_type = as_type or card.name

        # 发出 card_played 事件（无懈可击、八卦阵等可在此 cancel）
        ev = self.bus.emit("card_played",
                           source=source, card=card, target=target, as_type=as_type)
        if ev.cancelled:
            self.ui.log(f"{card.plain} 被【无懈可击】抵消")
            # 仍要弃掉这张牌
            source.hand.remove(card)
            self.deck.discard(card)
            return

        # 出杀计数
        if as_type == "杀":
            self.kill_count_this_turn += 1

        # 离手
        if card in source.hand:
            source.hand.remove(card)

        self.ui.log(f"{source.name} 对 "
                    f"{target.name if target else '无目标'} 使用 {card.display}（{as_type}）")

        # 分发到具体结算
        if as_type == "杀":
            self.resolve_kill(source, target, card)
        elif as_type == "桃":
            self.resolve_peach(source, card)
        elif as_type == "无中生有":
            drawn = self.deck.draw(2)
            source.hand.extend(drawn)
            self.ui.log(f"  {source.name} 摸 2 张")
        elif as_type == "决斗":
            self.resolve_duel(source, target, card)
        elif as_type == "南蛮入侵":
            self.resolve_aoe(source, "杀", card)
        elif as_type == "万箭齐发":
            self.resolve_aoe(source, "闪", card)
        elif as_type == "桃园结义":
            self.resolve_tao(source, card)
        elif as_type == "借刀杀人":
            self.resolve_jie_dao(source, target, card)
        elif as_type == "过河拆桥":
            self.resolve_deal_break(source, target, card)
        elif as_type == "顺手牵羊":
            self.resolve_steal(source, target, card)
        elif card.type == "equipment":
            self.equip(source, card)
            return  # 装备不进弃牌堆
        else:
            self.ui.log(f"  (未实现的卡牌效果: {as_type})")

        # 进弃牌堆
        self.deck.discard(card)
        self.bus.emit("card_resolved", source=source, card=card, target=target)

    # =========================================================================
    # 杀 / 闪
    # =========================================================================
    def resolve_kill(self, source: Player, target: Player, card: Card):
        # 杀使用事件；技能可改 dodge_needed（如吕布-无双要求两张闪）
        kev = self.bus.emit("kill_used",
                            source=source, target=target, card=card, dodge_needed=1)
        need = kev["dodge_needed"]
        dodged = 0
        for _ in range(need):
            if self.ask_dodge(target, source):
                dodged += 1
            else:
                break
        if dodged >= need:
            self.ui.log(f"  {target.name} 闪避成功")
            return
        # 伤害
        self.deal_damage(source, target, 1, reason="杀", card=card)

    def ask_dodge(self, target: Player, source: Player) -> bool:
        """询问 target 是否出闪抵消来自 source 的杀"""
        # 八卦阵判定：50% 视为出闪
        if target.has_equipment_effect("bagua"):
            # 简化：50% 概率生效
            if random.random() < 0.5:
                self.ui.log(f"  {target.name}【八卦阵】生效，视为出闪")
                return True
        # 查 闪源（含龙胆转化的杀）
        ev = self.bus.emit("query_play_sources",
                           player=target, target_type="闪", sources=[])
        sources = ev["sources"]
        if not sources:
            return False
        decision = self.ui.ask_response(target, source, "闪", sources, reason="dodge")
        if decision:
            card, as_type = decision
            target.hand.remove(card)
            self.deck.discard(card)
            self.bus.emit("card_played",
                          source=target, card=card, target=source, as_type=as_type)
            return True
        return False

    # =========================================================================
    # 桃
    # =========================================================================
    def resolve_peach(self, source: Player, card: Card):
        if source.hp >= source.max_hp:
            self.ui.log(f"  {source.name} 已满血，桃无效")
            return
        source.hp += 1
        self.bus.emit("hp_changed", player=source, old=source.hp - 1, new=source.hp)
        self.ui.log(f"  {source.name} 回复 1 体力 -> {source.hp}/{source.max_hp}")

    def resolve_tao(self, source: Player, card: Card):
        """桃园结义：所有未满血玩家回 1"""
        for p in self.alive_players():
            if p.hp < p.max_hp:
                p.hp += 1
                self.bus.emit("hp_changed", player=p, old=p.hp - 1, new=p.hp)
                self.ui.log(f"  {p.name} 回复 1 体力")

    # =========================================================================
    # 决斗
    # =========================================================================
    def resolve_duel(self, source: Player, target: Player, card: Card):
        """轮流出杀，先不出者受 1 点伤害"""
        self.ui.log(f"  决斗开始：{source.name} vs {target.name}")
        current, opponent = target, source  # 目标先出
        while True:
            ev = self.bus.emit("query_play_sources",
                               player=current, target_type="杀", sources=[])
            decision = self.ui.ask_response(current, opponent, "杀", ev["sources"], reason="duel")
            if not decision:
                self.ui.log(f"  {current.name} 不出杀，受 1 点伤害")
                self.deal_damage(opponent, current, 1, reason="决斗", card=card)
                return
            c, as_type = decision
            current.hand.remove(c)
            self.deck.discard(c)
            self.bus.emit("card_played",
                          source=current, card=c, target=opponent, as_type=as_type)
            current, opponent = opponent, current

    # =========================================================================
    # AOE（南蛮/万箭）
    # =========================================================================
    def resolve_aoe(self, source: Player, response_type: str, card: Card):
        """所有其他玩家须出 response_type（杀/闪）否则受 1 伤"""
        for p in list(self.alive_players()):
            if p is source:
                continue
            ev = self.bus.emit("query_play_sources",
                               player=p, target_type=response_type, sources=[])
            decision = self.ui.ask_response(p, source, response_type, ev["sources"], reason="aoe")
            if decision:
                c, as_type = decision
                p.hand.remove(c)
                self.deck.discard(c)
                self.bus.emit("card_played",
                              source=p, card=c, target=source, as_type=as_type)
                self.ui.log(f"  {p.name} 出 {c.display} 抵消")
            else:
                self.ui.log(f"  {p.name} 受 1 点伤害")
                self.deal_damage(source, p, 1, reason=card.name, card=card)

    # =========================================================================
    # 借刀杀人
    # =========================================================================
    def resolve_jie_dao(self, source: Player, target: Player, card: Card):
        """令 target 对其攻击范围内另一玩家出杀；否则交出武器"""
        if not target.equipment["weapon"]:
            self.ui.log(f"  {target.name} 没有武器，借刀无效")
            return
        # 选目标：让 target 选择一个攻击范围内的非 source/非 target 玩家
        candidates = [p for p in self.alive_players()
                      if p is not source and p is not target
                      and self.in_attack_range(target, p)]
        if not candidates:
            self.ui.log(f"  {target.name} 攻击范围内无目标，借刀无效")
            return
        # AI/UI 选目标与决策
        chosen, kill_card = self.ui.ask_jie_dao(target, source, candidates)
        if chosen and kill_card:
            self.play_card(target, kill_card, chosen, "杀")
        else:
            # 交武器
            w = target.equipment["weapon"]
            target.equipment["weapon"] = None
            source.hand.append(w)
            self.ui.log(f"  {target.name} 交出 {w.plain} 给 {source.name}")

    # =========================================================================
    # 过河拆桥 / 顺手牵羊
    # =========================================================================
    def resolve_deal_break(self, source, target, card):
        """弃掉目标一张手牌或装备（简化：随机弃手牌）"""
        if not target.hand:
            self.ui.log(f"  {target.name} 无手牌可弃")
            return
        idx = self.ui.choose_target_card(source, target, "弃")
        if idx is None:
            idx = random.randrange(len(target.hand))
        c = target.hand.pop(idx)
        self.deck.discard(c)
        self.ui.log(f"  {source.name} 拆掉 {target.name} 的 {c.plain}")

    def resolve_steal(self, source, target, card):
        """拿走目标一张手牌或装备（简化：拿手牌）"""
        if not target.hand:
            self.ui.log(f"  {target.name} 无手牌可牵")
            return
        idx = self.ui.choose_target_card(source, target, "牵")
        if idx is None:
            idx = random.randrange(len(target.hand))
        c = target.hand.pop(idx)
        source.hand.append(c)
        self.ui.log(f"  {source.name} 顺手牵走 {target.name} 的 {c.plain}")

    # =========================================================================
    # 装备
    # =========================================================================
    def equip(self, player: Player, card: Card):
        slot = {
            "weapon": "weapon",
            "armor": "armor",
            "plus_horse": "plus_horse",
            "minus_horse": "minus_horse",
        }.get(card.subtype)
        if not slot:
            return
        old = player.equipment[slot]
        if old:
            self.deck.discard(old)
            self.ui.log(f"  替换 {old.plain} -> 弃")
        player.equipment[slot] = card
        self.ui.log(f"  {player.name} 装备 {card.plain}")

    # =========================================================================
    # 给牌（仁德等）
    # =========================================================================
    def give_cards(self, source: Player, target: Player, cards: List[Card]):
        for c in cards:
            source.hand.remove(c)
            target.hand.append(c)
        self.ui.log(f"{source.name} 给 {target.name} {len(cards)} 张牌")
        self.bus.emit("cards_given", source=source, target=target, cards=cards)

    # =========================================================================
    # 伤害与濒死
    # =========================================================================
    def deal_damage(self, source, target, amount, reason="", card=None):
        # 伤害事件，技能可改 amount 或 cancel（如减伤）
        ev = self.bus.emit("damage",
                           source=source, target=target, amount=amount,
                           reason=reason, card=card)
        if ev.cancelled:
            return
        amount = ev["amount"]
        if amount <= 0:
            return
        old = target.hp
        target.hp -= amount
        self.bus.emit("hp_changed", player=target, old=old, new=target.hp)
        self.ui.log(f"  {target.name} 受 {amount} 点伤害 -> {max(target.hp,0)}/{target.max_hp}")
        if target.hp <= 0:
            self.dying_phase(target, source)

    def dying_phase(self, player, killer):
        self.bus.emit("player_dying", player=player, killer=killer)
        # 依次询问其他存活玩家是否出桃相救
        for p in self.alive_players():
            if p is player:
                continue
            ev = self.bus.emit("query_play_sources",
                               player=p, target_type="桃", sources=[])
            decision = self.ui.ask_save(p, player, ev["sources"])
            if decision:
                c, _ = decision
                p.hand.remove(c)
                self.deck.discard(c)
                player.hp = 1
                self.bus.emit("hp_changed", player=player, old=0, new=1)
                self.ui.log(f"  {p.name} 出桃救 {player.name}！")
                return
        # 无人救，死亡
        self.kill_player(player, killer)

    def kill_player(self, player, killer):
        player.is_alive = False
        player.identity_revealed = True
        # 弃所有手牌与装备
        for c in list(player.hand):
            self.deck.discard(c)
        player.hand.clear()
        for slot in list(player.equipment.keys()):
            if player.equipment[slot]:
                self.deck.discard(player.equipment[slot])
                player.equipment[slot] = None
        self.bus.emit("player_dead", player=player, killer=killer)
        self.ui.show_death(player, killer)
        self.check_win()

    # =========================================================================
    # 距离与攻击范围
    # =========================================================================
    def distance(self, a: Player, b: Player) -> int:
        alive = self.alive_players()
        if a not in alive or b not in alive or a is b:
            return 999
        ia = alive.index(a)
        ib = alive.index(b)
        n = len(alive)
        d = min((ib - ia) % n, (ia - ib) % n)
        if d == 0:
            return 0
        if b.equipment["plus_horse"]:
            d += 1
        if a.equipment["minus_horse"]:
            d = max(1, d - 1)
        return d

    def in_attack_range(self, a: Player, b: Player) -> bool:
        return self.distance(a, b) <= a.attack_range

    # =========================================================================
    # 胜负判定
    # =========================================================================
    def check_win(self):
        lord = next((p for p in self.players if p.identity == IDENTITY_LORD), None)
        rebels = [p for p in self.players if p.identity == IDENTITY_REBEL and p.is_alive]
        spies = [p for p in self.players if p.identity == IDENTITY_SPY and p.is_alive]
        loyals = [p for p in self.players if p.identity == IDENTITY_LOYAL and p.is_alive]

        if lord and not lord.is_alive:
            # 主公死
            alive_others = [p for p in self.players if p.is_alive and p is not lord]
            if len(alive_others) == 1 and alive_others[0].identity == IDENTITY_SPY:
                self.game_over = True
                self.winner = "内奸（独胜）"
            else:
                self.game_over = True
                self.winner = "反贼"
            return

        # 主公活：反贼和内奸全灭 → 主忠胜
        if not rebels and not spies:
            self.game_over = True
            self.winner = "主公与忠臣"
            return
