// ================================
// 技能软编码系统
// ================================

// 效果类型常量
const EffectType = {
    DAMAGE: 'damage',
    HEAL: 'heal',
    BUFF_ATK: 'buffAtk',
    BUFF_DEF: 'buffDef',
    DEBUFF: 'debuff',
    SUMMON: 'summon',
    AOE: 'aoe',
    PIERCE: 'pierce',
    MULTISHOT: 'multishot',
    CONE: 'cone',
    MOVE: 'move',
    STUN: 'stun',
    POISON: 'poison',
    SLOW: 'slow',
    BURN: 'burn',
    CONFUSE: 'confuse',
    SHRED_DEF: 'shredDef',
    SILENCE: 'silence'
};

// 目标类型常量
const TargetType = {
    ENEMY: 'enemy',           // 敌方单位
    ALLY: 'ally',             // 友方单位（包括自己）
    SELF: 'self',             // 自身
    EMPTY: 'empty',           // 空格子
    ANY: 'any'                // 任意单位
};

// 技能分类常量
const SkillCategory = {
    NORMAL: 'normal',         // 普通伤害
    SPECIAL: 'special',       // 特殊技能
    SUMMON: 'summon',         // 召唤类
    BUFF: 'buff',             // 增益类
    DEBUFF: 'debuff',         // 减益类
    HEAL: 'heal',             // 治疗类
    AOE: 'aoe'                // 范围伤害
};

// 技能模板库
const SkillTemplates = {
    // 基础伤害技能模板
    basicDamage(range, damage, energyCost = 1) {
        return {
            range,
            energyCost,
            category: SkillCategory.NORMAL,
            effects: [
                { type: EffectType.DAMAGE, damage }
            ]
        };
    },

    // 基础治疗模板
    basicHeal(range, amount, energyCost = 1) {
        return {
            range,
            energyCost,
            targetType: TargetType.ALLY,
            category: SkillCategory.HEAL,
            effects: [
                { type: EffectType.HEAL, amount }
            ]
        };
    },

    // 基础增益模板
    basicBuff(range, stat, amount, turns = 3, energyCost = 1) {
        return {
            range,
            energyCost,
            targetType: TargetType.ALLY,
            category: SkillCategory.BUFF,
            effects: [
                { type: EffectType.BUFF, stat, amount, turns }
            ]
        };
    },

    // 中毒效果
    poison(damage, turns = 3) {
        return { type: EffectType.POISON, damage, turns };
    },

    // 眩晕效果
    stun(turns = 1) {
        return { type: EffectType.STUN, turns };
    },

    // 减速效果
    slow(amount, turns = 2) {
        return { type: EffectType.SLOW, amount, turns };
    },

    // 燃烧效果
    burn(damage, turns = 2) {
        return { type: EffectType.BURN, damage, turns };
    },

    // 破甲效果
    shredDef(amount, turns = 1) {
        return { type: EffectType.SHRED_DEF, amount, turns };
    },

    // 沉默效果
    silence(turns = 1) {
        return { type: EffectType.SILENCE, turns };
    }
};

// 武将技能定义
// 每个技能是一个配置对象，通过 effects 数组组合多个效果
const GeneralSkills = {
    // 赵云
    zhaoyun: {
        passive: [
            {
                id: 'changSheng',
                name: '常胜',
                type: 'passive',
                desc: '被动：击杀敌方武将时，立即恢复移动和攻击机会',
                effects: [
                    { type: 'passive', flag: '_passive_changSheng', value: true }
                ]
            }
        ],
        active: [
            {
                id: 'danYong',
                name: '胆勇',
                type: 'active',
                category: SkillCategory.SPECIAL,
                desc: '主动：十字4格选择敌方棋子，然后在其r2范围内选择一个空格作为落点，突进造成30伤害',
                energyCost: 0,
                step1: 'selectEnemy',
                step1Range: '+4',
                step2: 'selectLanding',
                step2Range: 'r2',
                effects: [
                    { type: EffectType.MOVE },
                    { type: EffectType.DAMAGE, damage: 30 }
                ]
            }
        ]
    },

    // 关羽
    guanyu: {
        passive: [
            {
                id: 'weiLin',
                name: '威临',
                type: 'passive',
                desc: '被动：周围+2范围内的敌方武将攻击力-10，周围+1范围内的敌方武将无法使用主动技能',
                effects: [
                    { type: 'passive', flag: '_passive_weiLin', value: true }
                ]
            }
        ],
        active: [
            {
                id: 'shuiYan',
                name: '水淹',
                type: 'active',
                category: SkillCategory.SPECIAL,
                desc: '主动：十字3格，对目标造成30伤害并减速1（持续2回合）。若目标在河流地形上，伤害翻倍',
                range: '+3',
                energyCost: 2,
                chargeTrigger: 'afterAction',
                targetType: TargetType.ENEMY,
                effects: [
                    { type: EffectType.DAMAGE, damage: 30, terrainBonus: { terrain: 2, multiplier: 2 } },
                    { type: EffectType.SLOW, amount: 1, turns: 2 }
                ]
            }
        ]
    },

    // 张飞
    zhangfei: {
        passive: [
            {
                id: 'shenSu',
                name: '神速',
                type: 'passive',
                desc: '被动：移动范围+1，攻击范围+1',
                effects: [
                    { type: 'passive', stat: 'mov', modify: 1 },
                    { type: 'passive', stat: 'attackRange', modify: '+1' }
                ]
            }
        ],
        active: [
            {
                id: 'luanWu',
                name: '乱舞',
                type: 'active',
                category: SkillCategory.AOE,
                desc: '主动：对目标周围r1范围内的所有敌方造成40伤害',
                range: '+2',
                energyCost: 3,
                chargeTrigger: 'afterAttack',
                targetType: TargetType.ENEMY,
                effects: [
                    { type: EffectType.AOE, damage: 40, range: 1 }
                ]
            }
        ]
    },

    // 诸葛亮
    zhugeliang: {
        passive: [
            {
                id: 'guanChuan',
                name: '观星',
                type: 'passive',
                desc: '被动：每回合开始时，为所有友方武将恢复10生命',
                effects: [
                    { type: 'passive', flag: '_passive_guanChuan', value: true }
                ],
                trigger: 'onTurn',
                triggerEffect: { type: EffectType.HEAL, amount: 10, targetType: TargetType.ALLY }
            }
        ],
        active: [
            {
                id: 'huoJian',
                name: '火箭',
                type: 'active',
                category: SkillCategory.SPECIAL,
                desc: '主动：对目标造成50伤害，若目标已燃烧则伤害翻倍',
                range: '+4',
                energyCost: 2,
                chargeTrigger: 'onTurn',
                targetType: TargetType.ENEMY,
                effects: [
                    { type: EffectType.DAMAGE, damage: 50, conditionBonus: { debuff: 'burn', multiplier: 2 } }
                ]
            },
            {
                id: 'jiSu',
                name: '极速',
                type: 'active',
                category: SkillCategory.BUFF,
                desc: '主动：使一名友方武将本回合可以再移动一次',
                range: '+3',
                energyCost: 1,
                targetType: TargetType.ALLY,
                effects: [
                    { type: EffectType.BUFF, stat: 'extraMove', value: 1, turns: 1 }
                ]
            }
        ]
    },

    // 曹操
    caocao: {
        passive: [
            {
                id: 'jianXiong',
                name: '奸雄',
                type: 'passive',
                desc: '被动：每次造成伤害时，回复等量的生命值',
                effects: [
                    { type: 'passive', flag: '_passive_jianXiong', value: true }
                ]
            }
        ],
        active: [
            {
                id: 'guoHe',
                name: '裹和',
                type: 'active',
                category: SkillCategory.SPECIAL,
                desc: '主动：对十字2格范围内的所有敌方造成25伤害，并使他们减速1',
                range: '+2',
                energyCost: 2,
                chargeTrigger: 'afterAction',
                targetType: TargetType.ENEMY,
                effects: [
                    { type: EffectType.AOE, damage: 25, range: 0 },
                    { type: EffectType.SLOW, amount: 1, turns: 2 }
                ]
            }
        ]
    },

    // 孙权
    sunquan: {
        passive: [
            {
                id: 'longMao',
                name: '龙袍',
                type: 'passive',
                desc: '被动：周围r2范围内的友方获得10%闪避',
                effects: [
                    { type: 'passive', flag: '_passive_longMao', value: true }
                ]
            }
        ],
        active: [
            {
                id: 'jiWu',
                name: '济武',
                type: 'active',
                category: SkillCategory.SUMMON,
                desc: '主动：在指定位置召唤一名士兵',
                range: '+2',
                energyCost: 2,
                targetType: TargetType.EMPTY,
                effects: [
                    { type: EffectType.SUMMON, unit: 'soldier' }
                ]
            }
        ]
    },

    // 黄忠
    huangzhong: {
        passive: [
            {
                id: 'lieGong',
                name: '烈弓',
                type: 'passive',
                desc: '被动：攻击范围永久+2',
                effects: [
                    { type: 'passive', stat: 'attackRange', modify: '+2' }
                ]
            }
        ],
        active: [
            {
                id: 'juShe',
                name: '剧射',
                type: 'active',
                category: SkillCategory.SPECIAL,
                desc: '主动：对一条直线上的所有敌方造成35伤害',
                range: '+6',
                energyCost: 3,
                chargeTrigger: 'afterAttack',
                targetType: TargetType.ENEMY,
                effects: [
                    { type: EffectType.PIERCE, damage: 35 }
                ]
            }
        ]
    },

    // 魏延
    weiyan: {
        passive: [
            {
                id: 'kuangluan',
                name: '狂乱',
                type: 'passive',
                desc: '被动：每损失20%生命，攻击力增加15',
                effects: [
                    { type: 'passive', flag: '_passive_kuangLuan', value: true }
                ]
            }
        ],
        active: [
            {
                id: 'zhanLi',
                name: '战栗',
                type: 'active',
                category: SkillCategory.SPECIAL,
                desc: '主动：对目标造成50伤害，并使目标眩晕1回合',
                range: '+1',
                energyCost: 2,
                chargeTrigger: 'afterAttack',
                targetType: TargetType.ENEMY,
                effects: [
                    { type: EffectType.DAMAGE, damage: 50 },
                    { type: EffectType.STUN, turns: 1 }
                ]
            }
        ]
    }
};

// 导出
window.SkillSystem = {
    EffectType,
    TargetType,
    SkillCategory,
    SkillTemplates,
    GeneralSkills
};
