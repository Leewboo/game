// ================================
// 游戏数据
// ================================

window.BOARD_SIZE = 12;

window.TERRAIN = [
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

window.TERRAIN_NAMES = { 0: 'grass', 1: 'mountain', 2: 'river', 3: 'city', 4: 'swamp', 5: 'bridge' };
window.TERRAIN_LABELS = { 0: '', 1: '山', 2: '～', 3: '城', 4: '沼', 5: '桥' };
window.BLOCKING_TERRAIN_MOVE = new Set([1, 2]);
window.BLOCKING_TERRAIN_ATTACK = new Set([1]);

window.SUMMONS = {
    soldier: { name: '士兵', hp: 40, atk: 8, def: 5, mov: 2 },
    archer: { name: '弓手', hp: 30, atk: 12, def: 3, mov: 2 },
    wall: { name: '盾墙', hp: 80, atk: 0, def: 20, mov: 0 }
};

// 武将基础数据
window.GENERALS = [
    {
        id: 'zhaoyun',
        name: '赵云',
        hp: 180, atk: 50, def: 20, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'changSheng', name: '常胜', type: 'passive', desc: '被动：击杀敌方武将时，立即恢复移动和攻击机会' },
            { id: 'danYong', name: '胆勇', type: 'active', category: 'special', desc: '主动：十字4格选择敌方棋子，然后在其r2范围内选择一个空格作为落点，突进造成30伤害', range: '+4', energyCost: 0, step1: 'selectEnemy', step1Range: '+4', step2: 'selectLanding', step2Range: 'r2' }
        ]
    },
    {
        id: 'guanyu',
        name: '关羽',
        hp: 200, atk: 45, def: 25, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: [
            { id: 'weiLin', name: '威临', type: 'passive', desc: '被动：周围+2范围内的敌方武将攻击力-10，周围+1范围内的敌方武将无法使用主动技能' },
            { id: 'shuiYan', name: '水淹', type: 'active', category: 'special', desc: '主动：十字3格，对目标造成30伤害并减速1（持续2回合）。若目标在河流地形上，伤害翻倍', range: '+3', energyCost: 2, chargeTrigger: 'afterAction' }
        ]
    },
    {
        id: 'zhangfei',
        name: '张飞',
        hp: 190, atk: 55, def: 15, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'shenSu', name: '神速', type: 'passive', desc: '被动：移动范围+1，攻击范围+1' },
            { id: 'luanWu', name: '乱舞', type: 'active', category: 'aoe', desc: '主动：对目标周围r1范围内的所有敌方造成40伤害', range: '+2', energyCost: 3, chargeTrigger: 'afterAttack' }
        ]
    },
    {
        id: 'zhugeliang',
        name: '诸葛亮',
        hp: 120, atk: 35, def: 15, mov: 2,
        moveRange: '+2', attackRange: '+3',
        skills: [
            { id: 'guanChuan', name: '观星', type: 'passive', desc: '被动：每回合开始时，为所有友方武将恢复10生命' },
            { id: 'huoJian', name: '火箭', type: 'active', category: 'special', desc: '主动：对目标造成50伤害，若目标已燃烧则伤害翻倍', range: '+4', energyCost: 2, chargeTrigger: 'onTurn' },
            { id: 'jiSu', name: '极速', type: 'active', category: 'buff', desc: '主动：使一名友方武将本回合可以再移动一次', range: '+3', energyCost: 1 }
        ]
    },
    {
        id: 'caocao',
        name: '曹操',
        hp: 160, atk: 40, def: 20, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: [
            { id: 'jianXiong', name: '奸雄', type: 'passive', desc: '被动：每次造成伤害时，回复等量的生命值' },
            { id: 'guoHe', name: '裹和', type: 'active', category: 'aoe', desc: '主动：对十字2格范围内的所有敌方造成25伤害，并使他们减速1', range: '+2', energyCost: 2, chargeTrigger: 'afterAction' }
        ]
    },
    {
        id: 'sunquan',
        name: '孙权',
        hp: 150, atk: 38, def: 22, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'longMao', name: '龙袍', type: 'passive', desc: '被动：周围r2范围内的友方获得10%闪避' },
            { id: 'jiWu', name: '济武', type: 'active', category: 'summon', desc: '主动：在指定位置召唤一名士兵', range: '+2', energyCost: 2 }
        ]
    },
    {
        id: 'huangzhong',
        name: '黄忠',
        hp: 140, atk: 52, def: 18, mov: 2,
        moveRange: '+2', attackRange: '+3',
        skills: [
            { id: 'lieGong', name: '烈弓', type: 'passive', desc: '被动：攻击范围永久+2' },
            { id: 'juShe', name: '剧射', type: 'active', category: 'special', desc: '主动：对一条直线上的所有敌方造成35伤害', range: '+6', energyCost: 3, chargeTrigger: 'afterAttack' }
        ]
    },
    {
        id: 'weiyan',
        name: '魏延',
        hp: 170, atk: 48, def: 18, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'kuangluan', name: '狂乱', type: 'passive', desc: '被动：每损失20%生命，攻击力增加15' },
            { id: 'zhanLi', name: '战栗', type: 'active', category: 'special', desc: '主动：对目标造成50伤害，并使目标眩晕1回合', range: '+1', energyCost: 2, chargeTrigger: 'afterAttack' }
        ]
    },
    {
        id: 'machao',
        name: '马超',
        hp: 165, atk: 46, def: 16, mov: 4,
        moveRange: '+4', attackRange: '+1',
        skills: [
            { id: 'tiandi', name: '铁骑', type: 'passive', desc: '被动：每移动一次，攻击力临时+5（持续到回合结束）' },
            { id: 'chongZhen', name: '冲锋', type: 'active', category: 'special', desc: '主动：突进到目标位置，对路径上所有敌方造成30伤害', range: '+5', energyCost: 1, step1: 'selectEnemy', step1Range: '+5', step2: 'selectLanding', step2Range: '+2' }
        ]
    },
    {
        id: 'lvbu',
        name: '吕布',
        hp: 200, atk: 55, def: 15, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'wushuang', name: '无双', type: 'passive', desc: '被动：攻击力+20，反击率+30%' },
            { id: 'fangTian', name: '方天画戟', type: 'active', category: 'special', desc: '主动：对目标造成80伤害', range: '+1', energyCost: 4 }
        ]
    },
    // 调试武将
    { id: 'debug1', name: '调试将甲', hp: 100, atk: 20, def: 10, mov: 3, moveRange: '+3', attackRange: '+1', skills: [{ id: 'testDmg1', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] },
    { id: 'debug2', name: '调试将乙', hp: 110, atk: 22, def: 12, mov: 2, moveRange: '+2', attackRange: '+1', skills: [{ id: 'testDmg2', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] },
    { id: 'debug3', name: '调试将丙', hp: 90, atk: 25, def: 8, mov: 3, moveRange: '+3', attackRange: '+1', skills: [{ id: 'testDmg3', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] },
    { id: 'debug4', name: '调试将丁', hp: 120, atk: 18, def: 15, mov: 2, moveRange: '+2', attackRange: '+1', skills: [{ id: 'testDmg4', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] },
    { id: 'debug5', name: '调试将戊', hp: 95, atk: 24, def: 11, mov: 3, moveRange: '+3', attackRange: '+1', skills: [{ id: 'testDmg5', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] },
    { id: 'debug6', name: '调试将己', hp: 105, atk: 19, def: 14, mov: 3, moveRange: '+3', attackRange: '+1', skills: [{ id: 'testDmg6', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] },
    { id: 'debug7', name: '调试将庚', hp: 85, atk: 28, def: 9, mov: 4, moveRange: '+4', attackRange: '+1', skills: [{ id: 'testDmg7', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] },
    { id: 'debug8', name: '调试将辛', hp: 115, atk: 17, def: 18, mov: 2, moveRange: '+2', attackRange: '+1', skills: [{ id: 'testDmg8', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] },
    { id: 'debug9', name: '调试将壬', hp: 100, atk: 21, def: 13, mov: 3, moveRange: '+3', attackRange: '+1', skills: [{ id: 'testDmg9', name: '测试打击', type: 'active', desc: '十字2格，造成10伤害', range: '+2', energyCost: 1 }] }
];
