// game.js - 最简流程控制（选将/布阵/战斗）
// 无AI，无动画。点"人机对战"当作双人对战启动。

const Game = {
    state: {
        currentPlayer: 1,
        turn: 1,
        selectedUnit: null,
        currentSkill: null,
        highlights: [],
        logs: [],
        units: [],
        players: {
            1: { generals: [], deployed: [] },
            2: { generals: [], deployed: [] }
        }
    },

    $(id) { return document.getElementById(id); },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = this.$(id + '-screen');
        if (el) el.classList.add('active');
    },

    log(msg) {
        this.state.logs.push(msg);
        const panel = this.$('log-panel');
        if (panel) panel.innerHTML = this.state.logs.slice(-12).map(l => '<div class="log-entry">' + l + '</div>').join('');
    },

    // ==================== 初始化 ====================
    init() {
        this.$('pvp-btn').onclick = () => this.startSelect();
        this.$('pve-btn').onclick = () => this.startSelect();
        this.$('custom-btn').onclick = () => alert('DIY武将：直接修改 js/data.js 中的 GENERALS 数组，或修改 js/skill.js 中的 SKILLS 配置');
        this.$('confirm-select').onclick = () => this.confirmSelect();
        this.$('end-turn').onclick = () => this.endTurn();
        this.$('restart-btn').onclick = () => { this.resetGame(); this.showScreen('menu'); };
        this.showScreen('menu');
    },

    resetGame() {
        this.state = {
            currentPlayer: 1, turn: 1, selectedUnit: null, currentSkill: null,
            highlights: [], logs: [], units: [],
            players: { 1: { generals: [], deployed: [] }, 2: { generals: [], deployed: [] } }
        };
    },

    // ==================== 选将 ====================
    startSelect() {
        this.state.currentPlayer = 1;
        this.state.players[1].generals = [];
        this.state.players[2].generals = [];
        this.renderSelect();
        this.showScreen('select');
    },

    renderSelect() {
        const p = this.state.currentPlayer;
        this.$('select-title').textContent = (p === 1 ? '红方' : '蓝方') + ' 选将';
        const selected = this.state.players[p].generals;
        this.$('select-count').textContent = selected.length + '/5';
        this.$('confirm-select').disabled = selected.length !== 5;

        const list = this.$('generals-list');
        list.innerHTML = window.GENERALS.map(g => {
            const isSel = selected.some(s => s.id === g.id);
            return '<div class="general-card ' + (isSel ? 'selected' : '') + '" data-id="' + g.id + '">' +
                '<div class="general-icon">' + g.name + '</div>' +
                '</div>';
        }).join('');
        list.querySelectorAll('.general-card').forEach(c => {
            c.onclick = () => {
                const id = c.dataset.id;
                const gens = this.state.players[p].generals;
                const idx = gens.findIndex(gg => gg.id === id);
                if (idx >= 0) gens.splice(idx, 1);
                else if (gens.length < 5) gens.push({ ...window.GENERALS.find(gg => gg.id === id) });
                this.renderSelect();
            };
        });
    },

    confirmSelect() {
        if (this.state.currentPlayer === 1) {
            this.state.currentPlayer = 2;
            this.renderSelect();
        } else {
            this.startDeploy();
        }
    },

    // ==================== 布阵 ====================
    startDeploy() {
        this.state.currentPlayer = 1;
        this.state.players[1].deployed = [];
        this.state.players[2].deployed = [];
        this.state.units = [];
        this.renderDeploy();
        this.showScreen('deploy');
    },

    renderDeploy() {
        const p = this.state.currentPlayer;
        this.$('deploy-title').textContent = (p === 1 ? '红方' : '蓝方') + ' 布阵（点击己方区域空格放置）';
        this.$('deploy-count').textContent = this.state.players[p].deployed.length + '/5';

        const board = this.$('deploy-board');
        board.innerHTML = '';
        for (let y = 0; y < window.BOARD_SIZE; y++) {
            for (let x = 0; x < window.BOARD_SIZE; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell ' + window.TERRAIN_NAMES[window.TERRAIN[y][x]];
                if (p === 1 && y >= window.BOARD_SIZE - 3) cell.classList.add('deploy-zone-p1');
                if (p === 2 && y <= 2) cell.classList.add('deploy-zone-p2');
                cell.dataset.x = x; cell.dataset.y = y;
                const u = this.getUnitAt(x, y);
                if (u) cell.innerHTML = '<div class="unit p' + u.player + '"><div class="unit-icon">' + u.name + '</div></div>';
                cell.onclick = () => this.handleDeployClick(x, y);
                board.appendChild(cell);
            }
        }

        const generals = this.state.players[p].generals;
        const deployed = this.state.players[p].deployed;
        this.$('deploy-list').innerHTML = generals.map((g, i) => {
            const isDep = deployed.some(d => d.generalId === g.id);
            return '<div class="mini-general ' + (isDep ? 'deployed' : '') + '">' + g.name + '</div>';
        }).join('');
    },

    handleDeployClick(x, y) {
        const p = this.state.currentPlayer;
        if (p === 1 && y < window.BOARD_SIZE - 3) return;
        if (p === 2 && y > 2) return;
        if (this.getUnitAt(x, y)) return;
        if (window.BLOCKING_TERRAIN_MOVE.has(window.TERRAIN[y][x])) return;

        const generals = this.state.players[p].generals;
        const deployed = this.state.players[p].deployed;
        const next = generals.find(g => !deployed.some(d => d.generalId === g.id));
        if (!next) return;

        this.createUnit(next, p, x, y);
        deployed.push({ generalId: next.id });

        if (deployed.length === 5) {
            if (p === 1) {
                this.state.currentPlayer = 2;
                this.renderDeploy();
            } else {
                this.startBattle();
            }
        } else {
            this.renderDeploy();
        }
    },

    createUnit(g, player, x, y) {
        const skills = window.SkillResolver.resolve(g.skillIds);
        const unit = {
            id: Math.random().toString(36).slice(2, 9),
            generalId: g.id, name: g.name, skills,
            player, x, y,
            hp: g.hp, maxHp: g.hp, atk: g.atk, def: g.def, mov: g.mov,
            moveRange: g.moveRange || '+' + g.mov, attackRange: g.attackRange || '+1',
            dead: false, moved: false, attacked: false, usedSkill: false
        };
        this.state.units.push(unit);
        return unit;
    },

    getUnitAt(x, y) {
        return this.state.units.find(u => u.x === x && u.y === y && !u.dead);
    },

    // ==================== 战斗 ====================
    startBattle() {
        // 触发 init 被动
        this.state.units.forEach(u => this.runPassive(u, 'init'));
        this.state.currentPlayer = 1;
        this.state.turn = 1;
        this.state.selectedUnit = null;
        this.state.currentSkill = null;
        this.state.highlights = [];
        this.log('⚔️ 战斗开始！红方先手');
        this.renderBattle();
        this.showScreen('battle');
    },

    runPassive(unit, trigger) {
        if (!unit || unit.dead || !unit.skills) return;
        unit.skills.forEach(skill => {
            if (!skill.passive) return;
            skill.passive.forEach(p => {
                if (p.trigger === trigger) {
                    window.Effect.execute(p.effects, unit, null, this.state);
                }
            });
        });
    },

    renderBattle() {
        this.$('turn-info').textContent = '第' + this.state.turn + '回合 ' + (this.state.currentPlayer === 1 ? '🔴红方' : '🔵蓝方');

        const board = this.$('battle-board');
        board.innerHTML = '';
        for (let y = 0; y < window.BOARD_SIZE; y++) {
            for (let x = 0; x < window.BOARD_SIZE; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell ' + window.TERRAIN_NAMES[window.TERRAIN[y][x]];
                const hl = this.state.highlights.find(h => h.x === x && h.y === y);
                if (hl) cell.classList.add('highlight-' + hl.type);
                cell.dataset.x = x; cell.dataset.y = y;
                const u = this.getUnitAt(x, y);
                if (u) {
                    const hpPct = ((u.hp / u.maxHp) * 100).toFixed(0);
                    const sel = this.state.selectedUnit && this.state.selectedUnit.id === u.id ? ' selected' : '';
                    cell.innerHTML = '<div class="unit p' + u.player + sel + '">' +
                        '<div class="unit-icon">' + u.name + '</div>' +
                        '<div class="unit-hp"><div class="unit-hp-fill" style="width:' + hpPct + '%"></div></div>' +
                        '</div>';
                }
                cell.onclick = () => this.handleBattleClick(x, y);
                board.appendChild(cell);
            }
        }

        this.renderPlayerBars();
        this.renderSelectedInfo();
    },

    renderPlayerBars() {
        [1, 2].forEach(p => {
            const bar = this.$('player' + p + '-generals');
            if (!bar) return;
            const units = this.state.units.filter(u => u.player === p && !u.dead);
            bar.innerHTML = units.map(u => {
                const hpPct = ((u.hp / u.maxHp) * 100).toFixed(0);
                const sel = this.state.selectedUnit && this.state.selectedUnit.id === u.id ? ' selected-bar' : '';
                return '<div class="bar-general' + sel + '" data-unit-id="' + u.id + '">' +
                    '<div class="bar-general-name">' + u.name + '</div>' +
                    '<div class="bar-general-hp"><div class="bar-general-hp-fill" style="width:' + hpPct + '%"></div></div>' +
                    '</div>';
            }).join('');
            bar.querySelectorAll('.bar-general').forEach(el => {
                el.onclick = () => {
                    const uid = el.dataset.unitId;
                    const u = this.state.units.find(uu => uu.id === uid);
                    if (!u) return;
                    this.state.selectedUnit = u;
                    this.state.currentSkill = null;
                    this.showMovesAndAttacks(u);
                    this.renderBattle();
                };
            });
        });
    },

    renderSelectedInfo() {
        const container = this.$('selected-info');
        if (!container) return;
        const u = this.state.selectedUnit;
        if (!u) { container.classList.add('hidden'); return; }
        container.classList.remove('hidden');

        const hpPct = ((u.hp / u.maxHp) * 100).toFixed(0);
        const actives = u.skills.filter(s => s.type === 'active');

        let skillHtml = '';
        actives.forEach(s => {
            const disabled = u.usedSkill || u.silenced ? ' disabled' : '';
            skillHtml += '<button class="sel-skill-btn' + disabled + '" data-skill="' + s.id + '">' + s.name + '</button>';
        });

        container.innerHTML = '<div class="selected-header"><div class="sel-name">' + u.name + '</div>' +
            '<div class="sel-hp-row"><span>❤️' + u.hp + '/' + u.maxHp + '</span>' +
            '<div class="sel-hp-bar"><div class="sel-hp-fill" style="width:' + hpPct + '%"></div></div>' +
            '<span>⚔️' + u.atk + '</span><span>🛡️' + u.def + '</span><span>🏃' + u.mov + '</span></div></div>' +
            '<div class="selected-skills">' + skillHtml + '</div>';

        container.querySelectorAll('.sel-skill-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.classList.contains('disabled')) return;
                const skill = u.skills.find(s => s.id === btn.dataset.skill);
                this.selectSkill(skill);
            };
        });
    },

    // ==================== 战斗点击处理 ====================
    handleBattleClick(x, y) {
        const unit = this.getUnitAt(x, y);
        const hl = this.state.highlights.find(h => h.x === x && h.y === y);

        // 技能模式
        if (this.state.currentSkill && hl && hl.type === 'skill') {
            if (unit && unit.player !== this.state.currentPlayer) {
                this.executeSkill(unit);
                return;
            }
            // AOE技能对空格也生效（对目标周围的敌人造成伤害）
            if (this.state.currentSkill.effects && this.state.currentSkill.effects.some(e => e.targetType && e.targetType.startsWith('aoe:'))) {
                this.executeSkillAOE(x, y);
                return;
            }
        }

        // 移动
        if (hl && hl.type === 'move' && this.state.selectedUnit) {
            this.executeMove(this.state.selectedUnit, x, y);
            return;
        }

        // 普通攻击
        if (hl && hl.type === 'attack' && this.state.selectedUnit && unit && unit.player !== this.state.currentPlayer) {
            this.executeAttack(this.state.selectedUnit, unit);
            return;
        }

        // 选择己方单位
        if (unit && unit.player === this.state.currentPlayer) {
            if (unit.stunned) { this.log('⛔ ' + unit.name + ' 眩晕中'); this.renderBattle(); return; }
            this.state.selectedUnit = unit;
            this.state.currentSkill = null;
            this.showMovesAndAttacks(unit);
            this.renderBattle();
            return;
        }

        // 点空白取消
        this.state.selectedUnit = null;
        this.state.currentSkill = null;
        this.state.highlights = [];
        this.renderBattle();
    },

    showMovesAndAttacks(unit) {
        this.state.highlights = [];
        const occupied = new Set();
        this.state.units.forEach(uu => { if (!uu.dead) occupied.add(uu.x + ',' + uu.y); });

        if (!unit.moved) {
            const cells = window.Range.parseBlocked(unit.moveRange, unit.x, unit.y, occupied, window.BLOCKING_TERRAIN_MOVE, window.TERRAIN);
            cells.forEach(p => this.state.highlights.push({ x: p.x, y: p.y, type: 'move' }));
        }

        if (!unit.attacked) {
            const cells = window.Range.parse(unit.attackRange, unit.x, unit.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
            cells.forEach(p => {
                const t = this.getUnitAt(p.x, p.y);
                if (t && t.player !== unit.player) this.state.highlights.push({ x: p.x, y: p.y, type: 'attack' });
            });
        }
    },

    selectSkill(skill) {
        this.state.currentSkill = skill;
        this.state.highlights = [];
        const u = this.state.selectedUnit;
        const cells = window.Range.parse(skill.range || '+1', u.x, u.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
        cells.forEach(p => {
            const t = this.getUnitAt(p.x, p.y);
            if (t && t.player !== u.player) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            // AOE技能：允许对空格施法（以空格为中心AOE）
            if (skill.effects && skill.effects.some(e => e.targetType && e.targetType.startsWith('aoe:'))) {
                if (!t) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            }
        });
        this.log('💫 选择技能：' + skill.name);
        this.renderBattle();
    },

    executeMove(unit, x, y) {
        unit.x = x; unit.y = y; unit.moved = true;
        this.runPassive(unit, 'afterMove');
        this.state.highlights = [];
        this.log('🏃 ' + unit.name + ' 移动至 (' + x + ',' + y + ')');
        this.showMovesAndAttacks(unit);
        this.renderBattle();
    },

    executeAttack(attacker, target) {
        const results = window.Effect.execute(
            [{ effectKey: 'damage', targetType: 'target', params: { amount: attacker.atk } }],
            attacker, target, this.state
        );
        attacker.attacked = true;
        const dmg = results[0] && results[0].amount || 0;
        if (target.dead) {
            this.log('💀 ' + attacker.name + ' 击杀 ' + target.name + '（-' + dmg + '）');
            this.runPassive(attacker, 'onKill');
        } else {
            this.log('⚔️ ' + attacker.name + ' 攻击 ' + target.name + ' -' + dmg);
        }
        this.state.highlights = [];
        this.checkWin();
        this.renderBattle();
    },

    executeSkill(target) {
        const skill = this.state.currentSkill;
        const caster = this.state.selectedUnit;
        const results = window.Effect.execute(skill.effects, caster, target, this.state);
        caster.usedSkill = true;
        this.log('⚡ ' + caster.name + ' 使用「' + skill.name + '」');
        results.forEach(r => {
            if (r.targetId) {
                const killed = this.state.units.find(uu => uu.id === r.targetId);
                if (killed && killed.dead) {
                    this.log('💀 ' + killed.name + ' 被击败');
                    this.runPassive(caster, 'onKill');
                }
            }
        });
        this.state.currentSkill = null;
        this.state.highlights = [];
        this.checkWin();
        this.renderBattle();
    },

    executeSkillAOE(x, y) {
        const skill = this.state.currentSkill;
        const caster = this.state.selectedUnit;
        // 以 (x, y) 为"虚拟目标"执行AOE效果
        const virtualTarget = { x, y };
        const results = window.Effect.execute(skill.effects, caster, virtualTarget, this.state);
        caster.usedSkill = true;
        this.log('⚡ ' + caster.name + ' 使用「' + skill.name + '」于 (' + x + ',' + y + ')');
        results.forEach(r => {
            if (r.targetId) {
                const killed = this.state.units.find(uu => uu.id === r.targetId);
                if (killed && killed.dead) {
                    this.log('💀 ' + killed.name + ' 被击败');
                    this.runPassive(caster, 'onKill');
                }
            }
        });
        this.state.currentSkill = null;
        this.state.highlights = [];
        this.checkWin();
        this.renderBattle();
    },

    // ==================== 回合流转 ====================
    endTurn() {
        // 结算当前玩家 debuff
        this.state.units.forEach(u => {
            if (u.player === this.state.currentPlayer) window.Effect.tickDebuffs(u, this.state);
        });

        this.state.currentPlayer = this.state.currentPlayer === 1 ? 2 : 1;
        if (this.state.currentPlayer === 1) this.state.turn++;

        // 重置行动 + 触发回合开始被动
        this.state.units.forEach(u => {
            if (u.player === this.state.currentPlayer && !u.dead) {
                u.moved = false; u.attacked = false; u.usedSkill = false;
                this.runPassive(u, 'onTurnStart');
            }
        });

        this.state.selectedUnit = null;
        this.state.currentSkill = null;
        this.state.highlights = [];
        this.checkWin();
        this.log('--- 第' + this.state.turn + '回合 ' + (this.state.currentPlayer === 1 ? '🔴红方' : '🔵蓝方') + ' ---');
        this.renderBattle();
    },

    checkWin() {
        const p1Alive = this.state.units.some(u => u.player === 1 && !u.dead);
        const p2Alive = this.state.units.some(u => u.player === 2 && !u.dead);
        if (!p1Alive) this.endGame(2);
        else if (!p2Alive) this.endGame(1);
    },

    endGame(winner) {
        this.$('winner-text').textContent = (winner === 1 ? '🔴红方' : '🔵蓝方') + ' 胜利！';
        this.showScreen('gameover');
    }
};

window.Game = Game;
document.addEventListener('DOMContentLoaded', () => Game.init());
