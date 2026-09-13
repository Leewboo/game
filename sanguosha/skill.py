"""技能基类

技能 = 一个挂在玩家上的小对象，订阅一组事件来介入游戏。
所有内置技能（standard.py）和 DIY 技能（custom_generals/）都继承 Skill。

attach 时同时传入 player / bus / game，子类因此可：
    - 通过 self.owner 访问宿主玩家
    - 通过 self.bus 发射 / 订阅事件
    - 通过 self.game 调用 deck.draw() / deal_damage() 等

典型实现见 standard.py：
    class WuSheng(Skill):       # 关羽-武圣
        name = "武圣"
        def subscribe(self, bus):
            bus.subscribe("query_play_sources", self.on_query)

        def on_query(self, ev):
            if ev["player"] is self.owner and ev["target_type"] == "杀":
                for c in self.owner.hand:
                    if c.color == "red" and c.name != "杀":
                        if not any(s[0] is c for s in ev["sources"]):
                            ev["sources"].append((c, "杀"))
"""


class Skill:
    name: str = "未命名技能"
    description: str = ""

    def __init__(self):
        self.owner = None     # 玩家实例（attach 时设置）
        self.bus = None       # 事件总线（attach 时设置）
        self.game = None      # 游戏引用（attach 时设置，可访问 deck 等）

    def attach(self, player, bus, game):
        """被装备到 player 上时调用：保存上下文并订阅事件"""
        self.owner = player
        self.bus = bus
        self.game = game
        self.subscribe(bus)

    def subscribe(self, bus):
        """子类重写：用 bus.subscribe(event_name, handler) 注册"""
        pass

    def detach(self, bus):
        """子类按需重写：取消订阅"""
        pass

    def __repr__(self):
        return f"<Skill {self.name}>"
