"""武将基类与注册表

General = 名字 + 最大体力 + 技能类列表
注册表 GENERAL_REGISTRY 通过装饰器 @register_general 收集所有武将类
然后由 load_generals() 自动加载内置包和 custom_generals/ 目录
"""

import importlib
import pkgutil
from typing import List, Type, Dict


GENERAL_REGISTRY: Dict[str, Type["General"]] = {}


class General:
    """武将基类

    子类只需声明 name / max_hp / skills 三属性即可
    """

    name: str = "未命名"
    max_hp: int = 4
    # 技能类列表（类对象，会在 attach 时实例化）
    skill_classes: List[Type] = []

    def __init__(self):
        self.name = self.__class__.name
        self.max_hp = self.__class__.max_hp
        self.skills = []  # Skill 实例，由 Game 在 setup 时实例化并 attach

    def __repr__(self):
        return f"<General {self.name} hp={self.max_hp}>"


def register_general(cls: Type[General]) -> Type[General]:
    """类装饰器：把武将类注册到全局表"""
    GENERAL_REGISTRY[cls.name] = cls
    return cls


def all_generals() -> List[Type[General]]:
    return list(GENERAL_REGISTRY.values())


def get_general(name: str) -> Type[General]:
    return GENERAL_REGISTRY[name]


def load_generals(built_in_pkg: str = "sanguosha.generals",
                  custom_pkg: str = "sanguosha.custom_generals"):
    """自动加载两个包下的所有 .py 模块（触发 @register_general 装饰）

    built_in_pkg : 内置武将包（sanguosha.generals）
    custom_pkg   : 用户 DIY 武将目录（sanguosha.custom_generals）
    """
    for pkg in (built_in_pkg, custom_pkg):
        try:
            mod = importlib.import_module(pkg)
        except ImportError:
            # custom 包可能不存在；自动创建空 __init__
            continue
        for _, name, ispkg in pkgutil.iter_modules(mod.__path__):
            if name.startswith("_"):
                continue
            importlib.import_module(f"{pkg}.{name}")
