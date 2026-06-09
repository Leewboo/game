// ================================
// 游戏数据
// ================================

const BOARD_SIZE_DATA = 12;
window.BOARD_SIZE = BOARD_SIZE_DATA;

// 地形类型: 0=草地 1=山脉(阻断移动/攻击) 2=河流(阻断移动,可攻击) 3=城池 4=沼泽 5=桥梁(可通行)
// 历史战役风: 参考赤壁/官渡, 河流弯曲, 有渡口桥梁作为必争通道
const TERRAIN = [
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 1],
    [0, 0, 2, 2, 2, 5, 5, 2, 2, 2, 0, 0],
    [0, 0, 2, 2, 2, 5, 5, 2, 2, 2, 0, 0],
    [0, 0, 2, 2, 2, 5, 5, 2, 2, 2, 0, 0],
    [0, 0, 2, 2, 2, 5, 5, 2, 2, 2, 0, 0],
    [1, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0]
];

const TERRAIN_NAMES = { 0: 'grass', 1: 'mountain', 2: 'river', 3: 'city', 4: 'swamp', 5: 'bridge' };
window.TERRAIN_NAMES = TERRAIN_NAMES;

const TERRAIN_LABELS = { 0: '', 1: '山', 2: '～', 3: '城', 4: '沼', 5: '桥' };
window.TERRAIN_LABELS = TERRAIN_LABELS;

window.TERRAIN = TERRAIN;

// 地形阻断规则: 哪些地形ID会阻断移动/攻击范围
const BLOCKING_TERRAIN_MOVE = new Set([1, 2]); // 山脉+河流阻断移动
window.BLOCKING_TERRAIN_MOVE = BLOCKING_TERRAIN_MOVE;

const BLOCKING_TERRAIN_ATTACK = new Set([1]); // 山脉阻断攻击(河流可攻击跨越)
window.BLOCKING_TERRAIN_ATTACK = BLOCKING_TERRAIN_ATTACK;

const SUMMONS = {
    soldier: { name: '士兵', hp: 40, atk: 8, def: 5, mov: 2 },
    archer: { name: '弓手', hp: 30, atk: 12, def: 3, mov: 2 },
    wall: { name: '盾墙', hp: 80, atk: 0, def: 20, mov: 0 }
};
window.SUMMONS = SUMMONS;

// 能量获取条件（已废弃，改为技能级充能机制 chargeTrigger）
const ENERGY_ON_KILL = 0;
window.ENERGY_ON_KILL = ENERGY_ON_KILL;

const ENERGY_ON_HURT = 0;
window.ENERGY_ON_HURT = ENERGY_ON_HURT;

const ENERGY_ON_TURN = 0;
window.ENERGY_ON_TURN = ENERGY_ON_TURN;

const ENERGY_ON_ATTACK = 0;
window.ENERGY_ON_ATTACK = ENERGY_ON_ATTACK;

// ========================================
// 武将数据 - 软编码技能配置
// ========================================

// 技能效果类型
const E = {
    // 伤害效果
    DMG: (dmg) => ({ type: 'damage', damage: dmg }),
    // 治疗效果
    HEAL: (amt) => ({ type: 'heal', amount: amt }),
    // 增益效果
    BUFF: (stat, val, turns = 3) => ({ type: 'buff', stat, value: val, turns }),
    // 减益效果
    DEBUFF: (type, params = {}) => ({ type: 'debuff', debuffType: type, ...params }),
    // 召唤
    SUMMON: (unitType) => ({ type: 'summon', unit: unitType }),
    // AOE范围伤害
    AOE: (dmg, range = 1) => ({ type: 'aoe', damage: dmg, range }),
    // 穿透伤害
    PIERCE: (dmg) => ({ type: 'pierce', damage: dmg }),
    // 移动
    MOVE: () => ({ type: 'move' }),
    // 被动标记
    PASSIVE: (flag, val = true) => ({ type: 'passive', flag, value: val }),
    // 属性修改
    STAT_MOD: (stat, mod) => ({ type: 'passive', stat, modify: mod })
};

// 技能创建辅助函数
function createPassive(id, name, desc, effects, trigger = null, triggerEffect = null) {
    const skill = { id, name, type: 'passive', desc, effects };
    if (trigger) {
        skill.trigger = trigger;
        skill.triggerEffect = triggerEffect;
    }
    return skill;
}

function createActive(id, name, desc, effects, config = {}) {
    return {
        id,
        name,
        type: 'active',
        desc,
        effects,
        range: config.range || '+1',
        energyCost: config.energyCost || 1,
        chargeTrigger: config.chargeTrigger || null,
        targetType: config.targetType || 'enemy',
        category: config.category || 'normal',
        // 多步技能配置
        step1: config.step1 || null,
        step1Range: config.step1Range || null,
        step2: config.step2 || null,
        step2Range: config.step2Range || null
    };
}

// 武将技能定义
const GeneralSkillsConfig = {
    // 赵云
    zhaoyun: {
        passive: [
            createPassive(
                'changSheng',
                '常胜',
                '被动：击杀敌方武将时，立即恢复移动和攻击机会',
                [E.PASSIVE('_passive_changSheng', true)]
            )
        ],
        active: [
            createActive(
                'danYong',
                '胆勇',
                '主动：十字4格选择敌方棋子，然后在其r2范围内选择一个空格作为落点，突进造成30伤害',
                [E.MOVE(), E.DMG(30)],
                {
                    energyCost: 0,
                    step1: 'selectEnemy',
                    step1Range: '+4',
                    step2: 'selectLanding',
                    step2Range: 'r2',
                    category: 'special'
                }
            )
        ]
    },

    // 关羽
    guanyu: {
        passive: [
            createPassive(
                'weiLin',
                '威临',
                '被动：周围+2范围内的敌方武将攻击力-10，周围+1范围内的敌方武将无法使用主动技能',
                [E.PASSIVE('_passive_weiLin', true)]
            )
        ],
        active: [
            createActive(
                'shuiYan',
                '水淹',
                '主动：十字3格，对目标造成30伤害并减速1（持续2回合）。若目标在河流地形上，伤害翻倍',
                [
                    { type: 'damage', damage: 30, terrainBonus: { terrain: 2, multiplier: 2 } },
                    E.DEBUFF('slow', { amount: 1, turns: 2 })
                ],
                {
                    range: '+3',
                    energyCost: 2,
                    chargeTrigger: 'afterAction',
                    category: 'special'
                }
            )
        ]
    },

    // 张飞
    zhangfei: {
        passive: [
            createPassive(
                'shenSu',
                '神速',
                '被动：移动范围+1，攻击范围+1',
                [
                    E.STAT_MOD('mov', 1),
                    E.STAT_MOD('attackRange', '+1')
                ]
            )
        ],
        active: [
            createActive(
                'luanWu',
                '乱舞',
                '主动：对目标周围r1范围内的所有敌方造成40伤害',
                [E.AOE(40, 1)],
                {
                    range: '+2',
                    energyCost: 3,
                    chargeTrigger: 'afterAttack',
                    category: 'aoe'
                }
            )
        ]
    },

    // 诸葛亮
    zhugeliang: {
        passive: [
            createPassive(
                'guanChuan',
                '观星',
                '被动：每回合开始时，为所有友方武将恢复10生命',
                [E.PASSIVE('_passive_guanChuan', true)],
                'onTurn',
                E.HEAL(10)
            )
        ],
        active: [
            createActive(
                'huoJian',
                '火箭',
                '主动：对目标造成50伤害，若目标已燃烧则伤害翻倍',
                [{ type: 'damage', damage: 50, conditionBonus: { debuff: 'burn', multiplier: 2 } }],
                {
                    range: '+4',
                    energyCost: 2,
                    chargeTrigger: 'onTurn',
                    category: 'special'
                }
            ),
            createActive(
                'jiSu',
                '极速',
                '主动：使一名友方武将本回合可以再移动一次',
                [E.BUFF('extraMove', 1, 1)],
                {
                    range: '+3',
                    energyCost: 1,
                    targetType: 'ally',
                    category: 'buff'
                }
            )
        ]
    },

    // 曹操
    caocao: {
        passive: [
            createPassive(
                'jianXiong',
                '奸雄',
                '被动：每次造成伤害时，回复等量的生命值',
                [E.PASSIVE('_passive_jianXiong', true)]
            )
        ],
        active: [
            createActive(
                'guoHe',
                '裹和',
                '主动：对十字2格范围内的所有敌方造成25伤害，并使他们减速1',
                [
                    { type: 'aoe', damage: 25, range: 0 },
                    E.DEBUFF('slow', { amount: 1, turns: 2 })
                ],
                {
                    range: '+2',
                    energyCost: 2,
                    chargeTrigger: 'afterAction',
                    category: 'aoe'
                }
            )
        ]
    },

    // 孙权
    sunquan: {
        passive: [
            createPassive(
                'longMao',
                '龙袍',
                '被动：周围r2范围内的友方获得10%闪避',
                [E.PASSIVE('_passive_longMao', true)]
            )
        ],
        active: [
            createActive(
                'jiWu',
                '济武',
                '主动：在指定位置召唤一名士兵',
                [E.SUMMON('soldier')],
                {
                    range: '+2',
                    energyCost: 2,
                    targetType: 'empty',
                    category: 'summon'
                }
            )
        ]
    },

    // 黄忠
    huangzhong: {
        passive: [
            createPassive(
                'lieGong',
                '烈弓',
                '被动：攻击范围永久+2',
                [E.STAT_MOD('attackRange', '+2')]
            )
        ],
        active: [
            createActive(
                'juShe',
                '剧射',
                '主动：对一条直线上的所有敌方造成35伤害',
                [E.PIERCE(35)],
                {
                    range: '+6',
                    energyCost: 3,
                    chargeTrigger: 'afterAttack',
                    category: 'special'
                }
            )
        ]
    },

    // 魏延
    weiyan: {
        passive: [
            createPassive(
                'kuangluan',
                '狂乱',
                '被动：每损失20%生命，攻击力增加15',
                [E.PASSIVE('_passive_kuangLuan', true)]
            )
        ],
        active: [
            createActive(
                'zhanLi',
                '战栗',
                '主动：对目标造成50伤害，并使目标眩晕1回合',
                [
                    E.DMG(50),
                    E.DEBUFF('stun', { turns: 1 })
                ],
                {
                    range: '+1',
                    energyCost: 2,
                    chargeTrigger: 'afterAttack',
                    category: 'special'
                }
            )
        ]
    },

    // 马超
    machao: {
        passive: [
            createPassive(
                'tiandi',
                '铁骑',
                '被动：每移动一次，攻击力临时+5（持续到回合结束）',
                [E.PASSIVE('_passive_tianTi', true)]
            )
        ],
        active: [
            createActive(
                'chongZhen',
                '冲锋',
                '主动：突进到目标位置，对路径上所有敌方造成30伤害',
                [
                    E.MOVE(),
                    E.AOE(30, 0)
                ],
                {
                    energyCost: 1,
                    step1: 'selectEnemy',
                    step1Range: '+5',
                    step2: 'selectLanding',
                    step2Range: '+2',
                    category: 'special'
                }
            )
        ]
    },

    // 吕布
    lvbu: {
        passive: [
            createPassive(
                'wushuang',
                '无双',
                '被动：攻击力+20，反击率+30%',
                [
                    E.STAT_MOD('atk', 20),
                    E.PASSIVE('_counterRate', 0.3)
                ]
            )
        ],
        active: [
            createActive(
                'fangTian',
                '方天画戟',
                '主动：对目标造成80伤害，若击杀则立即恢复50生命',
                [E.DMG(80)],
                {
                    range: '+1',
                    energyCost: 4,
                    category: 'special'
                }
            )
        ]
    }
};

// 调试武将技能
for (let i = 1; i <= 9; i++) {
    GeneralSkillsConfig[`debug${i}`] = {
        passive: [],
        active: [
            createActive(
                `testDmg${i}`,
                '测试打击',
                '十字2格，造成10伤害',
                [E.DMG(10)],
                { range: '+2', energyCost: 1 }
            )
        ]
    };
}

// 武将基础数据
const GENERALS = [
    {
        id: 'zhaoyun',
        name: '赵云',
        hp: 180, atk: 50, def: 20, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            ...GeneralSkillsConfig.zhaoyun.passive,
            ...GeneralSkillsConfig.zhaoyun.active
        ]
    },
    {
        id: 'guanyu',
        name: '关羽',
        hp: 200, atk: 45, def: 25, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: [
            ...GeneralSkillsConfig.guanyu.passive,
            ...GeneralSkillsConfig.guanyu.active
        ]
    },
    {
        id: 'zhangfei',
        name: '张飞',
        hp: 190, atk: 55, def: 15, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            ...GeneralSkillsConfig.zhangfei.passive,
            ...GeneralSkillsConfig.zhangfei.active
        ]
    },
    {
        id: 'zhugeliang',
        name: '诸葛亮',
        hp: 120, atk: 35, def: 15, mov: 2,
        moveRange: '+2', attackRange: '+3',
        skills: [
            ...GeneralSkillsConfig.zhugeliang.passive,
            ...GeneralSkillsConfig.zhugeliang.active
        ]
    },
    {
        id: 'caocao',
        name: '曹操',
        hp: 160, atk: 40, def: 20, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: [
            ...GeneralSkillsConfig.caocao.passive,
            ...GeneralSkillsConfig.caocao.active
        ]
    },
    {
        id: 'sunquan',
        name: '孙权',
        hp: 150, atk: 38, def: 22, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            ...GeneralSkillsConfig.sunquan.passive,
            ...GeneralSkillsConfig.sunquan.active
        ]
    },
    {
        id: 'huangzhong',
        name: '黄忠',
        hp: 140, atk: 52, def: 18, mov: 2,
        moveRange: '+2', attackRange: '+3',
        skills: [
            ...GeneralSkillsConfig.huangzhong.passive,
            ...GeneralSkillsConfig.huangzhong.active
        ]
    },
    {
        id: 'weiyan',
        name: '魏延',
        hp: 170, atk: 48, def: 18, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            ...GeneralSkillsConfig.weiyan.passive,
            ...GeneralSkillsConfig.weiyan.active
        ]
    },
    {
        id: 'machao',
        name: '马超',
        hp: 165, atk: 46, def: 16, mov: 4,
        moveRange: '+4', attackRange: '+1',
        skills: [
            ...GeneralSkillsConfig.machao.passive,
            ...GeneralSkillsConfig.machao.active
        ]
    },
    {
        id: 'lvbu',
        name: '吕布',
        hp: 200, atk: 55, def: 15, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            ...GeneralSkillsConfig.lvbu.passive,
            ...GeneralSkillsConfig.lvbu.active
        ]
    },
    // 调试武将
    {
        id: 'debug1', name: '调试将甲', hp: 100, atk: 20, def: 10, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: GeneralSkillsConfig.debug1.active
    },
    {
        id: 'debug2', name: '调试将乙', hp: 110, atk: 22, def: 12, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: GeneralSkillsConfig.debug2.active
    },
    {
        id: 'debug3', name: '调试将丙', hp: 90, atk: 25, def: 8, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: GeneralSkillsConfig.debug3.active
    },
    {
        id: 'debug4', name: '调试将丁', hp: 120, atk: 18, def: 15, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: GeneralSkillsConfig.debug4.active
    },
    {
        id: 'debug5', name: '调试将戊', hp: 95, atk: 24, def: 11, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: GeneralSkillsConfig.debug5.active
    },
    {
        id: 'debug6', name: '调试将己', hp: 105, atk: 19, def: 14, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: GeneralSkillsConfig.debug6.active
    },
    {
        id: 'debug7', name: '调试将庚', hp: 85, atk: 28, def: 9, mov: 4,
        moveRange: '+4', attackRange: '+1',
        skills: GeneralSkillsConfig.debug7.active
    },
    {
        id: 'debug8', name: '调试将辛', hp: 115, atk: 17, def: 18, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: GeneralSkillsConfig.debug8.active
    },
    {
        id: 'debug9', name: '调试将壬', hp: 100, atk: 21, def: 13, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: GeneralSkillsConfig.debug9.active
    }
];

window.GENERALS = GENERALS;
window.GeneralSkillsConfig = GeneralSkillsConfig;
