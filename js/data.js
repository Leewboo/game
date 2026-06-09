// data.js - 地形、召唤物、武将纯数据
window.BOARD_SIZE = 12;

window.TERRAIN = [
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 1],
    [0, 0, 2, 2, 2, 5, 5, 2, 2, 2, 0, 0],
    [0, 0, 2, 2, 2, 5, 5, 2, 2, 2, 0, 0],
    [0, 0, 2, 2, 2, 5, 5, 2, 2, 2, 0, 0],
    [0, 0, 2, 2, 2, 5, 5, 2, 2, 2, 0, 0],
    [1, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0]
];

window.TERRAIN_NAMES = { 0: 'grass', 1: 'mountain', 2: 'river', 3: 'city', 4: 'swamp', 5: 'bridge' };
window.BLOCKING_TERRAIN_MOVE = new Set([1, 2]);
window.BLOCKING_TERRAIN_ATTACK = new Set([1]);

window.SUMMONS = {
    soldier: { name: '士兵', hp: 40, atk: 8, def: 5, mov: 2 },
    archer: { name: '弓手', hp: 30, atk: 12, def: 3, mov: 2 },
    wall: { name: '盾墙', hp: 80, atk: 0, def: 20, mov: 0 }
};

window.GENERALS = [
    { id: 'zhaoyun', name: '赵云', hp: 180, atk: 50, def: 20, mov: 3, moveRange: '+3', attackRange: '+1', skillIds: ['changSheng', 'danYong'] },
    { id: 'guanyu', name: '关羽', hp: 200, atk: 45, def: 25, mov: 2, moveRange: '+2', attackRange: '+1', skillIds: ['weiLin', 'shuiYan'] },
    { id: 'zhangfei', name: '张飞', hp: 190, atk: 55, def: 15, mov: 3, moveRange: '+3', attackRange: '+1', skillIds: ['shenSu', 'luanWu'] },
    { id: 'zhugeliang', name: '诸葛亮', hp: 120, atk: 35, def: 15, mov: 2, moveRange: '+2', attackRange: '+3', skillIds: ['guanXing', 'huoJian'] },
    { id: 'caocao', name: '曹操', hp: 160, atk: 40, def: 20, mov: 2, moveRange: '+2', attackRange: '+1', skillIds: ['weiLin', 'danYong'] },
    { id: 'sunquan', name: '孙权', hp: 150, atk: 38, def: 22, mov: 3, moveRange: '+3', attackRange: '+1', skillIds: ['guanXing', 'shuiYan'] },
    { id: 'huangzhong', name: '黄忠', hp: 140, atk: 52, def: 18, mov: 2, moveRange: '+2', attackRange: '+3', skillIds: ['shenSu', 'huoJian'] },
    { id: 'machao', name: '马超', hp: 165, atk: 46, def: 16, mov: 4, moveRange: '+4', attackRange: '+1', skillIds: ['changSheng', 'luanWu'] }
];
