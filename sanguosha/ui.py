"""控制台 UI

负责：
- 渲染当前局面（所有玩家 / 自己手牌 / 装备）
- 人类玩家的命令解析（play / give / end / info）
- 把 AI 的决策函数包装成与人类同样的 Action 接口
- 询问响应（出闪 / 决斗出杀 / AOE 出牌 / 出桃救人 / 借刀选目标）
"""

import os
import sys
from dataclasses import dataclass
from typing import Optional, List

from .player import Player
from .card import Card
from .action import Action
from .ai import AI


C_CYAN = "\033[36m"
C_YELLOW = "\033[33m"
C_GREEN = "\033[32m"
C_RED = "\033[31m"
C_DARK = "\033[90m"
C_BOLD = "\033[1m"
C_RESET = "\033[0m"


class ConsoleUI:
    def __init__(self):
        self.game = None
        self.ai = None  # 延迟初始化
        self.human: Optional[Player] = None
        self.logs: List[str] = []  # 待显示日志

    # =========================================================================
    # 日志
    # =========================================================================
    def log(self, msg: str, important: bool = False):
        if important:
            print(f"{C_CYAN}{C_BOLD}{msg}{C_RESET}")
        else:
            print(msg)

    # =========================================================================
    # 开局与终局
    # =========================================================================
    def show_start(self):
        print("\n" + "=" * 60)
        print(f"{C_YELLOW}{'三国杀 · 控制台版':^50}{C_RESET}")
        print("=" * 60)
        for p in self.game.players:
            idn = p.identity_view(self.human)
            tag = "（你）" if p is self.human else ""
            print(f"  {p.name}  武将: {p.general.name}  体力: {p.hp}/{p.max_hp}  身份: {idn} {tag}")
        print()

    def show_end(self, winner):
        print("\n" + "=" * 60)
        print(f"{C_GREEN}游戏结束！胜方：{winner}{C_RESET}")
        for p in self.game.players:
            print(f"  {p.name}  {p.general.name}  身份: {p.identity}")
        print("=" * 60)

    def show_death(self, player, killer):
        kname = killer.name if killer else "未知"
        print(f"{C_RED}  {player.name}（{player.general.name}）阵亡！身份：{player.identity}（凶手：{kname}）{C_RESET}")

    # =========================================================================
    # 渲染
    # =========================================================================
    def render(self):
        os.system("clear" if os.name == "posix" else "cls")
        print(C_YELLOW + "=" * 10 + " 三国杀 控制台 " + "=" * 10 + C_RESET)
        print()

        # 所有玩家
        for i, p in enumerate(self.game.players):
            cur = "▶" if i == self.game.current_idx else " "
            idn = p.identity_view(self.human)
            hp_bar = "❤" * max(p.hp, 0) + "·" * (p.max_hp - max(p.hp, 0))
            dead_tag = f"{C_RED}[亡]{C_RESET}" if not p.is_alive else ""
            me_tag = f"{C_GREEN}(你){C_RESET}" if p is self.human else ""
            eq_summary = self._equipment_summary(p)
            print(f"{cur} {p.name} {p.general.name:<6} "
                  f"{C_RED}{hp_bar}{C_RESET}  身份:{idn} {dead_tag} {me_tag} {eq_summary}")
        print()

        # 自己手牌
        if self.human.is_alive:
            print(f"{C_BOLD}你的手牌（{len(self.human.hand)}）:{C_RESET}")
            for i, c in enumerate(self.human.hand):
                print(f"  [{i}] {c.display}")
        else:
            print(f"{C_DARK}（你已阵亡，观战中）{C_RESET}")
        print()

    def _equipment_summary(self, p: Player) -> str:
        parts = []
        for slot, label in [("weapon", "武"), ("armor", "防"),
                            ("plus_horse", "+马"), ("minus_horse", "-马")]:
            c = p.equipment[slot]
            parts.append(f"{label}:{c.plain if c else '—'}")
        return " ".join(parts)

    # =========================================================================
    # 出牌阶段动作询问
    # =========================================================================
    def get_action(self, player: Player) -> Action:
        if not player.is_human:
            if self.ai is None:
                self.ai = AI(self.game, self)
            return self.ai.decide_action(player)

        # 人类玩家
        while True:
            self.render()
            print(f"{C_CYAN}回合动作：{C_RESET}")
            print("  play <手牌索引> [目标玩家编号]  使用手牌")
            print("  give <目标> <牌索引...>        给牌（如仁德）")
            print("  end                            结束出牌阶段")
            print("  info <玩家编号>                查看玩家详情")
            cmd = input("  > ").strip().lower()
            try:
                if cmd == "end":
                    return Action(kind="end")
                elif cmd.startswith("info"):
                    parts = cmd.split()
                    if len(parts) < 2:
                        print("用法：info <玩家编号>")
                        continue
                    idx = int(parts[1]) - 1
                    if 0 <= idx < len(self.game.players):
                        return Action(kind="info", target=self.game.players[idx])
                elif cmd.startswith("play"):
                    parts = cmd.split()
                    if len(parts) < 2:
                        print("用法：play <手牌索引> [目标]")
                        continue
                    idx = int(parts[1])
                    if idx < 0 or idx >= len(player.hand):
                        print("手牌索引无效")
                        continue
                    card = player.hand[idx]
                    target = None
                    if len(parts) > 2:
                        tidx = int(parts[2]) - 1
                        if 0 <= tidx < len(self.game.players):
                            target = self.game.players[tidx]
                    # 检查卡牌是否合法可用（简化：杀需目标在范围内）
                    if card.name == "杀":
                        if target is None or target is player:
                            print("杀需指定目标")
                            continue
                        if not self.game.in_attack_range(player, target):
                            print(f"距离 {self.game.distance(player, target)} 超出攻击范围 {player.attack_range}")
                            continue
                    if card.name == "桃" and player.hp >= player.max_hp:
                        print("已满血，桃无效")
                        continue
                    if card.name == "决斗" and target is None:
                        print("决斗需指定目标")
                        continue
                    if card.name in ("过河拆桥", "顺手牵羊", "借刀杀人") and target is None:
                        print(f"{card.name} 需指定目标")
                        continue
                    return Action(kind="play", card=card, target=target, as_type=card.name)
                elif cmd.startswith("give"):
                    parts = cmd.split()
                    if len(parts) < 3:
                        print("用法：give <目标> <牌索引...>")
                        continue
                    tidx = int(parts[1]) - 1
                    if not (0 <= tidx < len(self.game.players)):
                        print("目标无效")
                        continue
                    target = self.game.players[tidx]
                    if target is player:
                        print("不能给自己")
                        continue
                    indices = [int(x) for x in parts[2:]]
                    cards = [player.hand[i] for i in indices
                             if 0 <= i < len(player.hand)]
                    if not cards:
                        print("无效的牌索引")
                        continue
                    return Action(kind="give", target=target, cards=cards)
                else:
                    print("未知命令；可选: play / give / end / info")
            except (ValueError, IndexError) as e:
                print(f"输入错误: {e}")

    # =========================================================================
    # 弃牌
    # =========================================================================
    def choose_discard(self, player: Player, count: int) -> List[Card]:
        if not player.is_human:
            if self.ai is None:
                self.ai = AI(self.game, self)
            return self.ai.choose_discard(player, count)

        while True:
            self.render()
            print(f"{C_RED}需弃 {count} 张牌{C_RESET}")
            print("输入要弃的牌索引（空格分隔），如: 0 2 3")
            cmd = input("  > ").strip()
            try:
                indices = [int(x) for x in cmd.split()]
                if len(indices) != count:
                    print(f"请输入 {count} 个索引")
                    continue
                cards = []
                for i in indices:
                    if i < 0 or i >= len(player.hand):
                        print(f"索引 {i} 无效")
                        break
                    cards.append(player.hand[i])
                else:
                    if len(set(indices)) != len(indices):
                        print("索引不能重复")
                        continue
                    return cards
            except ValueError:
                print("请输入数字")

    # =========================================================================
    # 被动响应
    # =========================================================================
    def ask_response(self, target, source, response_type, sources, reason=""):
        """询问 target 是否出 response_type（sources = [(card, as_type)]）"""
        if not sources:
            return None
        if not target.is_human:
            if self.ai is None:
                self.ai = AI(self.game, self)
            return self.ai.decide_response(target, source, response_type, sources, reason)

        # 人类
        reason_desc = {
            "dodge": f"{source.name} 对你使用 杀，是否出 闪？",
            "aoe": f"{source.name} 出了 AOE，是否出 {response_type} 抵消？",
            "duel": f"{source.name} 与你决斗，是否出 杀？",
        }.get(reason, f"是否出 {response_type}？")

        while True:
            self.render()
            print(f"{C_RED}{reason_desc}{C_RESET}")
            print("可选响应:")
            for i, (c, as_type) in enumerate(sources):
                tag = f"（当作 {as_type}）" if as_type != c.name else ""
                print(f"  [{i}] {c.display} {tag}")
            print("输入索引出牌，或 'skip' 不出")
            cmd = input("  > ").strip().lower()
            if cmd == "skip":
                return None
            try:
                i = int(cmd)
                if 0 <= i < len(sources):
                    return sources[i]
                print("索引无效")
            except ValueError:
                print("请输入数字或 skip")

    def ask_save(self, savior, dying, sources):
        """询问 savior 是否出桃救 dying"""
        if not sources:
            return None
        if not savior.is_human:
            if self.ai is None:
                self.ai = AI(self.game, self)
            return self.ai.decide_save(savior, dying, sources)

        while True:
            self.render()
            print(f"{C_RED}{dying.name} 濒死！你（{savior.name}）是否出桃相救？{C_RESET}")
            for i, (c, at) in enumerate(sources):
                print(f"  [{i}] {c.display}")
            cmd = input("  出牌索引，或 'skip' > ").strip().lower()
            if cmd == "skip":
                return None
            try:
                i = int(cmd)
                if 0 <= i < len(sources):
                    return sources[i]
                print("索引无效")
            except ValueError:
                print("请输入数字或 skip")

    # =========================================================================
    # 借刀杀人：target 视角选目标并出杀
    # =========================================================================
    def ask_jie_dao(self, target, source, candidates):
        if not target.is_human:
            if self.ai is None:
                self.ai = AI(self.game, self)
            return self.ai.ask_jie_dao(target, source, candidates)

        self.render()
        print(f"{source.name} 对你使用【借刀杀人】。请选择攻击范围内的目标出杀，或交出武器。")
        for i, p in enumerate(candidates):
            print(f"  [{i}] {p.name} {p.general.name} ({p.hp} hp)")
        # 查杀源
        ev = self.game.bus.emit("query_play_sources",
                                player=target, target_type="杀", sources=[])
        print("你的可用杀:")
        for j, (c, at) in enumerate(ev["sources"]):
            print(f"    杀[{j}] {c.display}")
        if not ev["sources"]:
            print("你没有杀牌，将交出武器。")
            input("回车继续...")
            return None, None
        cmd = input("输入'交'交出武器，或 '<目标i> <杀j>' 出杀 > ").strip().lower()
        if cmd == "交":
            return None, None
        try:
            ti, kj = cmd.split()
            ti, kj = int(ti), int(kj)
            return candidates[ti], ev["sources"][kj][0]
        except (ValueError, IndexError):
            print("输入错误，将交出武器")
            return None, None

    # =========================================================================
    # 拆牌/牵羊时让攻击方选目标手牌索引
    # =========================================================================
    def choose_target_card(self, source, target, action):
        if not source.is_human:
            return None  # AI 用随机
        self.render()
        print(f"{target.name} 的手牌（共 {len(target.hand)} 张，背面朝下）")
        print("输入索引选择，或随机选输入 'r'")
        cmd = input("  > ").strip().lower()
        if cmd == "r":
            return None
        try:
            return int(cmd)
        except ValueError:
            return None

    def show_player_info(self, player):
        self.render()
        print(f"{C_BOLD}{player.name} - {player.general.name}{C_RESET}")
        print(f"  体力: {player.hp}/{player.max_hp}  身份(对你): {player.identity_view(self.human)}")
        print(f"  技能: {', '.join(s.name for s in player.skills) or '无'}")
        print(f"  攻击范围: {player.attack_range}  装备:")
        for slot in player.equipment:
            c = player.equipment[slot]
            print(f"    {slot}: {c.plain if c else '空'}")
        input("回车继续...")
