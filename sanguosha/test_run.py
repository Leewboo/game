"""端到端测试：用脚本驱动一次完整 AI vs AI 对局，验证引擎无报错。

用法：python -m sanguosha.test_run
"""
import random
from sanguosha.game import Game
from sanguosha.player import Player
from sanguosha.ui import ConsoleUI


class AutoUI(ConsoleUI):
    """测试用 UI：人类玩家也走 AI 决策，不读 stdin"""
    def __init__(self):
        super().__init__()
        self.human = None
        self._silent = False

    def render(self):
        pass  # 不渲染

    def log(self, msg, important=False):
        if not self._silent:
            print(msg)


def main():
    random.seed(42)
    players = [Player(f"P{i+1}", is_human=False) for i in range(4)]
    ui = AutoUI()
    ui.human = players[0]
    game = Game(players, ui)
    game.start()
    print("\n[测试] 对局正常结束，胜方:", game.winner)


if __name__ == "__main__":
    main()
