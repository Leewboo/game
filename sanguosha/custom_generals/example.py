"""DIY 武将示例

这是给用户参考的 DIY 模板。把新文件丢进 custom_generals/ 目录，
里面用 @register_general 装饰一个 General 子类，新武将就会被自动加载。

下面两个示例分别演示两种典型技能模式：

1. 吕布 - 无双：在【杀使用】事件里修改 dodge_needed 参数
                （让目标需要出 2 张闪才能抵消）。这是"修改结算参数型"。
2. 诸葛亮 - 观星：在【回合开始】事件里弹出 UI 让玩家查看并重排牌堆顶 3 张。
                这是"流程介入型"（含 UI 提示）。

复制本文件并修改即可做出你自己的武将；不需要改 engine/。
"""

from ..general import General, register_general
from ..skill import Skill


# =========================================================================
# 示例 1：吕布 - 无双
# =========================================================================
class WuShuang(Skill):
    """无双：使用杀时，目标需出 2 张闪才能抵消"""
    name = "无双"
    description = "使用杀时，目标需出 2 张闪才能抵消"

    def subscribe(self, bus):
        bus.subscribe("kill_used", self.on_kill_used)

    def on_kill_used(self, ev):
        # 仅当本技能宿主是杀的来源时生效
        if ev["source"] is self.owner:
            # 把 dodge_needed 从 1 改为 2（engine 中的 resolve_kill 会循环 N 次）
            ev["dodge_needed"] = 2
            print(f"  {self.owner.name}【无双】触发：需 2 张闪方可抵消")


@register_general
class LvBu(General):
    name = "吕布"
    max_hp = 4
    skill_classes = [WuShuang]


# =========================================================================
# 示例 2：诸葛亮 - 观星
# =========================================================================
class GuanXing(Skill):
    """观星：回合开始时，观看牌堆顶 3 张牌，可任意顺序放回"""
    name = "观星"
    description = "回合开始时，观看牌堆顶 3 张并任意顺序放回"

    def subscribe(self, bus):
        bus.subscribe("turn_start", self.on_turn_start)

    def on_turn_start(self, ev):
        if ev["player"] is not self.owner:
            return
        top = self.game.deck.peek(3)
        if not top:
            return

        print(f"\n  {self.owner.name}【观星】观看牌堆顶:")
        for i, c in enumerate(top):
            print(f"    [{i}] {c.display}")

        # 如果是人类玩家，让其重排；否则 AI 保持原序
        if self.owner.is_human:
            print("  输入新的顺序（如 '2 0 1' 表示把原[2]放最顶、原[1]放最底）")
            print("  回车跳过保持原序")
            cmd = input("  > ").strip()
            if cmd:
                try:
                    order = [int(x) for x in cmd.split()]
                    if len(order) == len(top) and set(order) == set(range(len(top))):
                        new_top = [top[i] for i in order]
                        self.game.deck.reorder_top(new_top)
                        print("  观星完成")
                        return
                except ValueError:
                    pass
                print("  输入无效，保持原序")
        # AI 或无效输入：原序放回（已是原序，无需操作）
        # AI 可以加一点简单策略：把杀放最顶（这里简化为不动）


@register_general
class ZhuGeLiang(General):
    name = "诸葛亮"
    max_hp = 3
    skill_classes = [GuanXing]


# =========================================================================
# 你可以这样继续 DIY：
#
# @register_general
# class MyGeneral(General):
#     name = "我的武将"
#     max_hp = 4
#     skill_classes = [MySkill]
#
# class MySkill(Skill):
#     name = "我的技能"
#     def subscribe(self, bus):
#         bus.subscribe("事件名", self.on_event)
#     def on_event(self, ev):
#         ...  # 修改 ev.data 或调用 ev.cancel()
# =========================================================================
