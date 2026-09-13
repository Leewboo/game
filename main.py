#!/usr/bin/env python3
"""三国杀 - 控制台版入口

启动：python main.py [玩家人数]
默认 4 人局（1 人 + 3 AI），身份：1主1忠2反。
支持 2-8 人。

注：游戏对人类玩家的命令行接口：
    play <手牌索引> [目标玩家编号]   使用手牌
    give <目标> <牌索引...>         给牌（仁德等）
    end                             结束出牌阶段
    info <玩家编号>                 查看玩家详情
"""

import sys

from sanguosha.game import Game
from sanguosha.player import Player
from sanguosha.ui import ConsoleUI


def main():
    n = 4
    if len(sys.argv) > 1:
        try:
            n = int(sys.argv[1])
        except ValueError:
            print("参数应为玩家人数（2-8）")
            return
    if not (2 <= n <= 8):
        print("玩家人数仅支持 2-8")
        return

    players = [Player(f"P{i+1}", is_human=(i == 0)) for i in range(n)]
    ui = ConsoleUI()
    ui.human = players[0]
    game = Game(players, ui)
    try:
        game.start()
    except KeyboardInterrupt:
        print("\n游戏被中断")


if __name__ == "__main__":
    main()
