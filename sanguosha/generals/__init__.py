"""内置标准武将包

每个武将继承 General，用 @register_general 注册即可被自动加载。
每个武将的 skill_classes 里列出技能类（继承 Skill）。
技能在 attach 时订阅事件，靠事件总线介入游戏流程。
"""
