// =================================================================
// skill.js - 所有技能的软编码配置（JSON 式描述）
// 设计要点：
//   - 每个技能是一个纯数据对象（effects 数组 + 元信息）
//   - game.js 只负责"在正确的时机调用 window.Effect.execute(effects, caster, target, state)"
//   - effect.js 负责每种 effectKey 的真实执行
//
//  要新增一个技能（用于DIY），只需在 window.SKILLS 下添加一项：
//    {
//      id: 'xxx', name: 'xxx', type: 'active'|'passive',
//      desc: '描述文本',
//      range: '+3',                       // 可选，主动技能选择范围
//      category: 'damage'|'aoe'|'special'|'summon'|'buff',
//      energyCost: 0,                     // 需多少能量才能释放
//      chargeTrigger: 'afterAction',      // 'afterAction'|'afterAttack'|'onTurn'|'afterMove'
//      selectStep1: 'enemy',              // 多步技能第一步选什么：'enemy'|'ally'|'empty'
//      selectStep1Range: '+4',            // 第一步选择范围
//      selectStep2: 'emptyInRange',       // 第二步选落点：'emptyInRange'(以目标为中心)
//      selectStep2Range: 'r2',            // 第二步范围
//      effects: [
//        { effectKey: 'moveTo',  targetType:'self', params:{ x:'__landingX__', y:'__landingY__' } },
//        { effectKey: 'damage',  targetType:'target', params:{ amount:30 } },
//        { effectKey: 'markStatus', targetType:'target', params:{ status:'slow', turns:2, amount:1 } }
//      ],
//      passive: [                          // 仅被动技能，{ trigger, effects }
//        { trigger: 'onKill', effects:[{ effectKey:'grantExtraAction', targetType:'self' }] }
//      ]
//    }
//
// 约定的占位符（game.js 调用 execute 前会替换）：
//   __landingX__ / __landingY__  => 多步技能中玩家选的落点坐标
//   __targetX__ / __targetY__    => 目标所在坐标（用于召唤类）
// =================================================================

window.SKILLS = {
    // ============================================================
    // 赵云
    // ============================================================
    changSheng: {
        id: 'changSheng', name: '常胜', type: 'passive',
        desc: '被动：击杀敌人时，立即恢复移动和攻击机会',
        passive: [
            { trigger: 'onKill', effects: [{ effectKey: 'grantExtraAction', targetType: 'self' }] }
        ]
    },
    danYong: {
        id: 'danYong', name: '胆勇', type: 'active', category: 'special',
        desc: '主动：十字4格选择敌人，然后在目标r2范围内选空格作为落点，突进造成30伤害',
        range: '+4',
        selectStep1: 'enemy', selectStep1Range: '+4',
        selectStep2: 'emptyInRange', selectStep2Range: 'r2',
        energyCost: 0,
        effects: [
            { effectKey: 'moveTo', targetType: 'self', params: { x: '__landingX__', y: '__landingY__' } },
            { effectKey: 'damage', targetType: 'target', params: { amount: 30 } }
        ]
    },

    // ============================================================
    // 关羽
    // ============================================================
    weiLin: {
        id: 'weiLin', name: '威临', type: 'passive',
        desc: '被动：周围十字2格内的敌方武将攻击力-10；十字1格内的敌方无法使用主动技能',
        passive: [
            { trigger: 'onTurnStart', effects: [
                { effectKey: 'markFlag', targetType: 'self', params: { flag: '_aura_weiLin', value: true } }
            ]}
        ]
    },
    shuiYan: {
        id: 'shuiYan', name: '水淹', type: 'active', category: 'damage',
        desc: '主动：十字3格对目标造成30伤害并减速2回合。若目标在河流上伤害翻倍',
        range: '+3',
        energyCost: 2, chargeTrigger: 'afterAction',
        effects: [
            { effectKey: 'damage', targetType: 'target', params: { amount: 30, terrainBonus: { terrain: 2, multiplier: 2 } } },
            { effectKey: 'markStatus', targetType: 'target', params: { status: 'slow', turns: 2, amount: 1 } }
        ]
    },

    // ============================================================
    // 张飞
    // ============================================================
    shenSu: {
        id: 'shenSu', name: '神速', type: 'passive',
        desc: '被动：移动范围+1，攻击范围+1',
        passive: [
            { trigger: 'init', effects: [
                { effectKey: 'modifyStat', targetType: 'self', params: { stat: 'mov', value: 1 } },
                { effectKey: 'markFlag', targetType: 'self', params: { flag: 'attackRangePlus', value: 1 } }
            ]}
        ]
    },
    luanWu: {
        id: 'luanWu', name: '乱舞', type: 'active', category: 'aoe',
        desc: '主动：对目标r1范围内所有敌人造成40伤害',
        range: '+2',
        energyCost: 3, chargeTrigger: 'afterAttack',
        effects: [
            { effectKey: 'damage', targetType: 'aoe:r1', params: { amount: 40 } }
        ]
    },

    // ============================================================
    // 诸葛亮
    // ============================================================
    guanXing: {
        id: 'guanXing', name: '观星', type: 'passive',
        desc: '被动：每回合开始为所有友方武将恢复10点生命',
        passive: [
            { trigger: 'onTurnStart', effects: [
                { effectKey: 'heal', targetType: 'allAllies', params: { amount: 10 } }
            ]}
        ]
    },
    huoJian: {
        id: 'huoJian', name: '火箭', type: 'active', category: 'damage',
        desc: '主动：对目标造成50伤害（若目标已燃烧则翻倍）',
        range: '+4',
        energyCost: 2, chargeTrigger: 'onTurn',
        effects: [
            { effectKey: 'damage', targetType: 'target', params: { amount: 50, burnBonus: 2 } }
        ]
    },
    jiSu: {
        id: 'jiSu', name: '极速', type: 'active', category: 'buff',
        desc: '主动：使一名友方武将本回合可再次行动',
        range: '+3',
        energyCost: 1, chargeTrigger: 'onTurn',
        effects: [
            { effectKey: 'grantExtraAction', targetType: 'target' }
        ]
    },

    // ============================================================
    // 曹操
    // ============================================================
    jianXiong: {
        id: 'jianXiong', name: '奸雄', type: 'passive',
        desc: '被动：每次造成伤害时，回复等量生命值',
        passive: [
            { trigger: 'init', effects: [
                { effectKey: 'markFlag', targetType: 'self', params: { flag: '_lifesteal_on_damage', value: true } }
            ]}
        ]
    },
    guoHe: {
        id: 'guoHe', name: '裹和', type: 'active', category: 'aoe',
        desc: '主动：对目标r2范围内所有敌人造成25伤害并减速1回合',
        range: '+2',
        energyCost: 2, chargeTrigger: 'afterAction',
        effects: [
            { effectKey: 'damage', targetType: 'aoe:r2', params: { amount: 25 } },
            { effectKey: 'markStatus', targetType: 'aoe:r2', params: { status: 'slow', turns: 1, amount: 1 } }
        ]
    },

    // ============================================================
    // 孙权
    // ============================================================
    longMao: {
        id: 'longMao', name: '龙袍', type: 'passive',
        desc: '被动：周围r2范围内的友方获得闪避光环（10%概率闪避普通攻击）',
        passive: [
            { trigger: 'init', effects: [
                { effectKey: 'markFlag', targetType: 'self', params: { flag: '_aura_dodge', value: true } }
            ]}
        ]
    },
    jiWu: {
        id: 'jiWu', name: '济武', type: 'active', category: 'summon',
        desc: '主动：在指定空格召唤一名士兵',
        range: '+2',
        energyCost: 2, chargeTrigger: 'onTurn',
        effects: [
            { effectKey: 'summon', targetType: 'target', params: { unitType: 'soldier', x: '__targetX__', y: '__targetY__' } }
        ]
    },

    // ============================================================
    // 黄忠
    // ============================================================
    lieGong: {
        id: 'lieGong', name: '烈弓', type: 'passive',
        desc: '被动：攻击范围永久+2',
        passive: [
            { trigger: 'init', effects: [
                { effectKey: 'markFlag', targetType: 'self', params: { flag: 'attackRangePlus', value: 2 } }
            ]}
        ]
    },
    juShe: {
        id: 'juShe', name: '剧射', type: 'active', category: 'special',
        desc: '主动：对目标方向一条直线上的所有敌人造成35伤害',
        range: '+6',
        energyCost: 3, chargeTrigger: 'afterAttack',
        effects: [
            { effectKey: 'damage', targetType: 'line:8', params: { amount: 35 } }
        ]
    },

    // ============================================================
    // 魏延
    // ============================================================
    kuangLuan: {
        id: 'kuangLuan', name: '狂乱', type: 'passive',
        desc: '被动：每损失20%生命，攻击力+15',
        passive: [
            { trigger: 'onTurnStart', effects: [
                { effectKey: 'markFlag', targetType: 'self', params: { flag: '_lowHp_atkBonus', value: true } }
            ]}
        ]
    },
    zhanLi: {
        id: 'zhanLi', name: '战栗', type: 'active', category: 'damage',
        desc: '主动：对目标造成50伤害并眩晕1回合',
        range: '+1',
        energyCost: 2, chargeTrigger: 'afterAttack',
        effects: [
            { effectKey: 'damage', targetType: 'target', params: { amount: 50 } },
            { effectKey: 'markStatus', targetType: 'target', params: { status: 'stun', turns: 1 } }
        ]
    },

    // ============================================================
    // 马超
    // ============================================================
    tieQi: {
        id: 'tieQi', name: '铁骑', type: 'passive',
        desc: '被动：每次移动后攻击力+5（持续至回合结束）',
        passive: [
            { trigger: 'afterMove', effects: [
                { effectKey: 'modifyStat', targetType: 'self', params: { stat: 'atk', value: 5, turns: 1 } }
            ]}
        ]
    },
    chongFeng: {
        id: 'chongFeng', name: '冲锋', type: 'active', category: 'special',
        desc: '主动：选一个敌人，在其r2范围内选一个空格作为落点，突进后对落点r1范围内所有敌人造成30伤害',
        range: '+5',
        selectStep1: 'enemy', selectStep1Range: '+5',
        selectStep2: 'emptyInRange', selectStep2Range: 'r2',
        energyCost: 1, chargeTrigger: 'afterMove',
        effects: [
            { effectKey: 'moveTo', targetType: 'self', params: { x: '__landingX__', y: '__landingY__' } },
            { effectKey: 'damage', targetType: 'aoe:r1', params: { amount: 30 } }
        ]
    },

    // ============================================================
    // 吕布
    // ============================================================
    wuShuang: {
        id: 'wuShuang', name: '无双', type: 'passive',
        desc: '被动：攻击力+20，反击率+30%',
        passive: [
            { trigger: 'init', effects: [
                { effectKey: 'modifyStat', targetType: 'self', params: { stat: 'atk', value: 20 } },
                { effectKey: 'markFlag', targetType: 'self', params: { flag: 'counterRate', value: 0.3 } }
            ]}
        ]
    },
    fangTian: {
        id: 'fangTian', name: '方天画戟', type: 'active', category: 'damage',
        desc: '主动：对目标造成80伤害',
        range: '+1',
        energyCost: 4, chargeTrigger: 'afterAttack',
        effects: [
            { effectKey: 'damage', targetType: 'target', params: { amount: 80 } }
        ]
    },

    // ============================================================
    // 调试武将 - 基础技能
    // ============================================================
    debugStrike: {
        id: 'debugStrike', name: '测试打击', type: 'active', category: 'damage',
        desc: '十字2格，造成10伤害',
        range: '+2',
        energyCost: 1,
        effects: [
            { effectKey: 'damage', targetType: 'target', params: { amount: 10 } }
        ]
    }
};

// ================================================================
// 通过 id 列表解析成完整技能对象（game.js 使用）
// ================================================================
window.SkillResolver = {
    resolve(ids) {
        if (!ids) return [];
        return ids.map(id => window.SKILLS[id]).filter(Boolean);
    }
};
