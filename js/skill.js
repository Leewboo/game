// skill.js - 技能纯数据配置
// 每个技能: { id, name, type: 'active'|'passive', desc, range, effects:[{effectKey,params,targetType}], passive:[{trigger,effects}] }
// trigger: 'onKill' | 'onTurnStart' | 'afterMove' | 'afterAttack' | 'init'
// effectKey: damage | heal | markStatus | markFlag | grantExtraAction | modifyStat

window.SKILLS = {
    changSheng: {
        id: 'changSheng', name: '常胜', type: 'passive',
        desc: '被动：击杀敌人时，立即恢复移动和攻击机会',
        passive: [{ trigger: 'onKill', effects: [{ effectKey: 'grantExtraAction', targetType: 'self' }] }]
    },
    danYong: {
        id: 'danYong', name: '胆勇', type: 'active',
        desc: '主动：十字3格对目标造成40伤害并减速1回合',
        range: '+3',
        effects: [
            { effectKey: 'damage', targetType: 'target', params: { amount: 40 } },
            { effectKey: 'markStatus', targetType: 'target', params: { status: 'slow', turns: 1, amount: 1 } }
        ]
    },
    weiLin: {
        id: 'weiLin', name: '威临', type: 'passive',
        desc: '被动：每回合开始使自己获得攻防提升标记',
        passive: [{ trigger: 'onTurnStart', effects: [
            { effectKey: 'markFlag', targetType: 'self', params: { flag: 'weiLinActive', value: true } }
        ] }]
    },
    shuiYan: {
        id: 'shuiYan', name: '水淹', type: 'active',
        desc: '主动：十字3格对目标造成30伤害并减速2回合',
        range: '+3',
        effects: [
            { effectKey: 'damage', targetType: 'target', params: { amount: 30 } },
            { effectKey: 'markStatus', targetType: 'target', params: { status: 'slow', turns: 2, amount: 1 } }
        ]
    },
    shenSu: {
        id: 'shenSu', name: '神速', type: 'passive',
        desc: '被动：攻击力+10',
        passive: [{ trigger: 'init', effects: [
            { effectKey: 'modifyStat', targetType: 'self', params: { stat: 'atk', value: 10 } }
        ] }]
    },
    luanWu: {
        id: 'luanWu', name: '乱舞', type: 'active',
        desc: '主动：对目标周围1格内所有敌人造成40伤害',
        range: '+2',
        effects: [{ effectKey: 'damage', targetType: 'aoe:1', params: { amount: 40 } }]
    },
    guanXing: {
        id: 'guanXing', name: '观星', type: 'passive',
        desc: '被动：每回合开始为所有友方武将恢复10点生命',
        passive: [{ trigger: 'onTurnStart', effects: [
            { effectKey: 'heal', targetType: 'allAllies', params: { amount: 10 } }
        ] }]
    },
    huoJian: {
        id: 'huoJian', name: '火箭', type: 'active',
        desc: '主动：十字4格对目标造成50伤害并使其燃烧2回合',
        range: '+4',
        effects: [
            { effectKey: 'damage', targetType: 'target', params: { amount: 50 } },
            { effectKey: 'markStatus', targetType: 'target', params: { status: 'burn', turns: 2, amount: 10 } }
        ]
    }
};

// 通过 id 列表解析成完整技能对象
window.SkillResolver = {
    resolve(ids) {
        if (!ids) return [];
        return ids.map(id => window.SKILLS[id]).filter(Boolean);
    }
};
