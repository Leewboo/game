"""三国杀 - 控制台版（事件驱动 / 可拓展武将）

包结构：
    event.py            事件总线
    card.py             卡牌与牌堆
    general.py          武将基类与注册表
    skill.py            技能基类
    player.py           玩家状态
    game.py             游戏引擎
    ai.py               简单 AI
    ui.py               控制台界面
    generals/standard.py    内置标准武将
    custom_generals/        DIY 武将目录（自动加载）
"""

__version__ = "0.1.0"
