// =================================================================
// data.js - 武将 / 召唤物 / 地形等纯数据
// 武将只包含基础属性 + skillIds（引用 skill.js 里的配置）
// 要 DIY 一个武将，只需在 GENERALS 下加一项：
//   { id:'xxx', name:'xx', hp:100, atk:20, def:5, mov:2,
//     moveRange:'+2', attackRange:'+1', skillIds:['skillA','skillB'] }
// =================================================================

window.BOARD_SIZE = 12;

window.TERRAIN = [
    [0,0,0,1,0,0,0,0,1,0,0,0],
    [0,3,0,0,0,0,0,0,0,0,3,0],
    [0,0,0,1,0,0,0,0,1,0,0,0],
    [1,0,0,0,0,5,5,0,0,0,0,1],
    [0,0,2,2,2,5,5,2,2,2,0,0],
    [0,0,2,2,2,5,5,2,2,2,0,0],
    [0,0,2,2,2,5,5,2,2,2,0,0],
    [0,0,2,2,2,5,5,2,2,2,0,0],
    [1,0,0,0,0,5,5,0,0,0,0,1],
    [0,0,0,1,0,0,0,0,1,0,0,0],
    [0,3,0,0,0,0,0,0,0,0,3,0],
    [0,0,0,1,0,0,0,0,1,0,0,0]
];

window.TERRAIN_NAMES = { 0:'grass', 1:'mountain', 2:'river', 3:'city', 4:'swamp', 5:'bridge' };
window.TERRAIN_LABELS = { 0:'', 1:'山', 2:'～', 3:'城', 4:'沼', 5:'桥' };
window.BLOCKING_TERRAIN_MOVE = new Set([1, 2]);
window.BLOCKING_TERRAIN_ATTACK = new Set([1]);

window.SUMMONS = {
    soldier: { name: '士兵', hp: 40, atk: 8, def: 5, mov: 2 },
    archer:  { name: '弓手', hp: 30, atk: 12, def: 3, mov: 2 },
    wall:    { name: '盾墙', hp: 80, atk: 0, def: 20, mov: 0 }
};

window.GENERALS = [
    { id:'zhaoyun',   name:'赵云', hp:180, atk:50, def:20, mov:3, moveRange:'+3', attackRange:'+1',
      skillIds:['changSheng','danYong'] },
    { id:'guanyu',    name:'关羽', hp:200, atk:45, def:25, mov:2, moveRange:'+2', attackRange:'+1',
      skillIds:['weiLin','shuiYan'] },
    { id:'zhangfei',  name:'张飞', hp:190, atk:55, def:15, mov:3, moveRange:'+3', attackRange:'+1',
      skillIds:['shenSu','luanWu'] },
    { id:'zhugeliang',name:'诸葛亮',hp:120, atk:35, def:15, mov:2, moveRange:'+2', attackRange:'+3',
      skillIds:['guanXing','huoJian','jiSu'] },
    { id:'caocao',    name:'曹操', hp:160, atk:40, def:20, mov:2, moveRange:'+2', attackRange:'+1',
      skillIds:['jianXiong','guoHe'] },
    { id:'sunquan',   name:'孙权', hp:150, atk:38, def:22, mov:3, moveRange:'+3', attackRange:'+1',
      skillIds:['longMao','jiWu'] },
    { id:'huangzhong',name:'黄忠', hp:140, atk:52, def:18, mov:2, moveRange:'+2', attackRange:'+3',
      skillIds:['lieGong','juShe'] },
    { id:'weiyan',    name:'魏延', hp:170, atk:48, def:18, mov:3, moveRange:'+3', attackRange:'+1',
      skillIds:['kuangLuan','zhanLi'] },
    { id:'machao',    name:'马超', hp:165, atk:46, def:16, mov:4, moveRange:'+4', attackRange:'+1',
      skillIds:['tieQi','chongFeng'] },
    { id:'lvbu',      name:'吕布', hp:200, atk:55, def:15, mov:3, moveRange:'+3', attackRange:'+1',
      skillIds:['wuShuang','fangTian'] },
    // 调试武将
    { id:'debug1', name:'调试将甲', hp:100, atk:20, def:10, mov:3, moveRange:'+3', attackRange:'+1', skillIds:['debugStrike'] },
    { id:'debug2', name:'调试将乙', hp:110, atk:22, def:12, mov:2, moveRange:'+2', attackRange:'+1', skillIds:['debugStrike'] },
    { id:'debug3', name:'调试将丙', hp:90, atk:25, def:8, mov:3, moveRange:'+3', attackRange:'+1', skillIds:['debugStrike'] },
    { id:'debug4', name:'调试将丁', hp:120, atk:18, def:15, mov:2, moveRange:'+2', attackRange:'+1', skillIds:['debugStrike'] },
    { id:'debug5', name:'调试将戊', hp:95, atk:24, def:11, mov:3, moveRange:'+3', attackRange:'+1', skillIds:['debugStrike'] },
    { id:'debug6', name:'调试将己', hp:105, atk:19, def:14, mov:3, moveRange:'+3', attackRange:'+1', skillIds:['debugStrike'] },
    { id:'debug7', name:'调试将庚', hp:85, atk:28, def:9, mov:4, moveRange:'+4', attackRange:'+1', skillIds:['debugStrike'] },
    { id:'debug8', name:'调试将辛', hp:115, atk:17, def:18, mov:2, moveRange:'+2', attackRange:'+1', skillIds:['debugStrike'] },
    { id:'debug9', name:'调试将壬', hp:100, atk:21, def:13, mov:3, moveRange:'+3', attackRange:'+1', skillIds:['debugStrike'] }
];
