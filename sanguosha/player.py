"""玩家状态：身份 / 血量 / 手牌 / 装备 / 是否存活"""


IDENTITY_LORD = "主公"
IDENTITY_LOYAL = "忠臣"
IDENTITY_REBEL = "反贼"
IDENTITY_SPY = "内奸"


class Player:
    def __init__(self, name: str, is_human: bool = False):
        self.name = name           # 展示名 P1/P2/...
        self.is_human = is_human
        self.general = None        # General 实例
        self.skills = []           # Skill 实例列表
        self.identity: str = ""    # 主公/忠臣/反贼/内奸
        self.hp: int = 0
        self.max_hp: int = 0
        self.hand = []            # List[Card]
        self.equipment = {          # 装备槽
            "weapon": None,
            "armor": None,
            "plus_horse": None,
            "minus_horse": None,
        }
        self.is_alive = True
        self.identity_revealed = False  # 死亡时翻面

    # ----------------- 装备相关 -----------------
    @property
    def attack_range(self) -> int:
        """当前攻击距离（武器射程，无武器为 1）"""
        w = self.equipment["weapon"]
        if w:
            return w.data.get("range", 1)
        return 1

    def has_equipment_effect(self, effect: str) -> bool:
        for slot, c in self.equipment.items():
            if c and c.effect == effect:
                return True
        return False

    def get_equipment(self, effect: str):
        for slot, c in self.equipment.items():
            if c and c.effect == effect:
                return c
        return None

    # ----------------- 技能相关 -----------------
    def has_skill(self, name: str) -> bool:
        return any(s.name == name for s in self.skills)

    def get_skill(self, name: str):
        for s in self.skills:
            if s.name == name:
                return s
        return None

    # ----------------- 展示 -----------------
    def identity_view(self, viewer):
        """对 viewer 而言此玩家的身份；只对主公和自己的身份公开"""
        if self.identity == IDENTITY_LORD:
            return IDENTITY_LORD
        if viewer is self:
            return self.identity
        if not self.is_alive:
            return self.identity
        return "?"

    def __repr__(self):
        return f"<Player {self.name} {self.general.name if self.general else '?'} {self.hp}/{self.max_hp}>"
