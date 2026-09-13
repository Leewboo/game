"""事件总线 - 技能介入游戏流程的核心机制

设计哲学：
    1. 游戏引擎在关键节点调用 bus.emit(event_name, **data)
    2. 已订阅该事件的技能按订阅顺序被调用
    3. 技能可以：
       - 修改 event["..."] 参数（如多摸一张牌、加大伤害）
       - 调用 event.cancel() 中断整个事件（如无懈可击抵消锦囊）
    4. 引擎读取 event.data 中的最终值继续流程

这样加新技能时无需改动引擎：只要找到对应事件挂上去即可。
所有内置与 DIY 技能都遵循同一套机制。

典型事件清单（详见 game.py 实际发射点）：
    turn_start          回合开始            {player}
    phase_draw_start    摸牌阶段开始        {player, count}    ← 可改 count
    phase_play_start    出牌阶段开始        {player}
    phase_play_end      出牌阶段结束        {player}
    phase_discard_start 弃牌阶段开始        {player, count}
    turn_end            回合结束            {player}
    card_played         任意牌被打出        {source, card, target, as_type}  ← 可 cancel
    card_resolved       任意牌结算完毕      {source, card, target}
    query_play_sources  查询某类牌的可用源  {player, target_type, sources} ← 追加 (card, as_type)
    query_kill_limit    查询出杀上限        {player, limit}    ← 可改 limit
    kill_used           杀被使用            {source, target, card, dodge_needed}  ← 可改 dodge_needed
    damage              伤害结算前          {source, target, amount, reason, card}  ← 可改 amount / cancel
    hp_changed          血量变化            {player, old, new}
    player_dying        玩家濒死            {player, killer}
    player_dead         玩家死亡            {player, killer}
"""

from typing import Any, Callable


class Event:
    """一次事件的载体；技能通过修改 .data 或 .cancel() 影响流程"""

    def __init__(self, name: str, **data):
        self.name = name
        self.data: dict = data
        self.cancelled = False

    def cancel(self):
        self.cancelled = True

    def __getitem__(self, key):
        return self.data[key]

    def __setitem__(self, key, value):
        self.data[key] = value

    def __contains__(self, key):
        return key in self.data

    def __repr__(self):
        return f"<Event {self.name} {self.data} cancel={self.cancelled}>"


class EventBus:
    """事件总线：维护事件名 -> 处理器列表的映射"""

    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}

    def subscribe(self, event_name: str, handler: Callable):
        """订阅事件；handler 形如 def h(ev: Event): ..."""
        self._handlers.setdefault(event_name, []).append(handler)

    def unsubscribe(self, event_name: str, handler: Callable):
        if event_name in self._handlers:
            try:
                self._handlers[event_name].remove(handler)
            except ValueError:
                pass

    def emit(self, event_name: str, **data) -> Event:
        """同步发射事件，返回最终 Event（含被修改的 data / cancelled 状态）"""
        ev = Event(event_name, **data)
        for handler in list(self._handlers.get(event_name, [])):
            if ev.cancelled:
                break
            handler(ev)
        return ev
