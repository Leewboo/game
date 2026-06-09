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

// 武将数据
const GENERALS = [
    {
        id: 'zhaoyun',
        name: '赵云',
        hp: 180,
        atk: 50,
        def: 20,
        mov: 3,
        moveRange: '+3',
        attackRange: '+1',
        skills: [
            {
                id: 'changSheng',
                name: '常胜',
                type: 'passive',
                category: 'special',
                content(a, t, gs) {
                    a._passive_changSheng = true;
                    return { type: 'passive' };
                },
                desc: '被动：击杀敌方武将时，立即恢复移动和攻击机会'
            },
            {
                id: 'danYong',
                name: '胆勇',
                type: 'active',
                category: 'special',
                range: '+4',
                // 胆勇不是充能技
                // 两步选择：先选敌人，再选落点
                step1: 'selectEnemy',   // 第一步：选择敌方棋子
                step1Range: '+4',
                step2: 'selectLanding', // 第二步：选择落点
                step2Range: 'r2',
                // content 在第二步执行，接收落点坐标
                content(a, t, gs, landingPos) {
                    // landingPos 是 {x, y} 落点
                    // 先移动，再造成伤害
                    const { Effect } = gs._modules;
                    const moveResult = Effect.moveTo(a, landingPos.x, landingPos.y);
                    const dmgResult = Effect.damage(a, t, 30);
                    return { ...dmgResult, type: 'danYong', move: moveResult };
                },
                desc: '主动：十字4格选择敌方棋子，然后在其r2范围内选择一个空格作为落点，突进造成30伤害（每回合限用一次）'
            }
        ]
    },
    {
        id: 'guanyu',
        name: '关羽',
        hp: 200,
        atk: 45,
        def: 25,
        mov: 2,
        moveRange: '+2',
        attackRange: '+1',
        skills: [
            {
                id: 'weiLin',
                name: '威临',
                type: 'passive',
                category: 'special',
                content(a, t, gs) {
                    a._passive_weiLin = true;
                    return { type: 'passive' };
                },
                desc: '被动：周围+2范围内的敌方武将攻击力-10。周围+1范围内的敌方武将无法使用主动技能'
            },
            {
                id: 'shuiYan',
                name: '水淹',
                type: 'active',
                category: 'special',
                range: '+3',
                energyCost: 2,
                chargeTrigger: 'afterAction',
                content(a, t, gs) {
                    const { Effect } = gs._modules;
                    const isRiver = TERRAIN[t.y] && TERRAIN[t.y][t.x] === 2;
                    const dmg = isRiver ? 60 : 30;
                    const dmgResult = Effect.damage(a, t, dmg);
                    const slowResult = Effect.slow(a, t, 1, 2);
                    return { ...dmgResult, type: 'shuiYan', slow: slowResult, riverBonus: isRiver };
                },
                desc: '主动：十字3格，对目标造成30伤害并减速1（持续2回合）。若目标在河流地形上，伤害翻倍'
            }
        ]
    },
    {
        id: 'debug1', name: '调试将甲', hp: 100, atk: 20, def: 10, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'testDmg1', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    },
    {
        id: 'debug2', name: '调试将乙', hp: 110, atk: 22, def: 12, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: [
            { id: 'testDmg2', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    },
    {
        id: 'debug3', name: '调试将丙', hp: 90, atk: 25, def: 8, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'testDmg3', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    },
    {
        id: 'debug4', name: '调试将丁', hp: 120, atk: 18, def: 15, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: [
            { id: 'testDmg4', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    },
    {
        id: 'debug5', name: '调试将戊', hp: 95, atk: 24, def: 11, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'testDmg5', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    },
    {
        id: 'debug6', name: '调试将己', hp: 105, atk: 19, def: 14, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'testDmg6', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    },
    {
        id: 'debug7', name: '调试将庚', hp: 85, atk: 28, def: 9, mov: 4,
        moveRange: '+4', attackRange: '+1',
        skills: [
            { id: 'testDmg7', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    },
    {
        id: 'debug8', name: '调试将辛', hp: 115, atk: 17, def: 18, mov: 2,
        moveRange: '+2', attackRange: '+1',
        skills: [
            { id: 'testDmg8', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    },
    {
        id: 'debug9', name: '调试将壬', hp: 100, atk: 21, def: 13, mov: 3,
        moveRange: '+3', attackRange: '+1',
        skills: [
            { id: 'testDmg9', name: '测试打击', type: 'active', category: 'normal', range: '+2', energyCost: 1, content(a, t, gs) { const { Effect } = gs._modules; return Effect.damage(a, t, 10); }, desc: '十字2格，造成10伤害' }
        ]
    }
];

window.GENERALS = GENERALS;
