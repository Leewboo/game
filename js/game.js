// =================================================================
// game.js - 纯流程控制（不包含任何武将/技能硬编码）
// 所有"什么技能产生什么效果"由 skill.js 的配置决定
// 所有"效果如何执行"由 effect.js 决定
// 本文件只管：选将、布阵、移动、攻击、技能选择目标、回合流转、胜负判定
// =================================================================

const Game = {
    state: {
        mode: 'pvp',
        currentPlayer: 1,
        turn: 1,
        selectedUnit: null,
        currentSkill: null,
        skillPhase: null,
        skillStep1Target: null,
        highlights: [],
        logs: [],
        units: [],
        players: { 1: { generals: [], deployed: [] }, 2: { generals: [], deployed: [] } }
    },

    init() {
        console.log('[Game] init');
        this.bindEvents();
        this.showScreen('menu');
    },

    bindEvents() {
        const el = (id) => document.getElementById(id);
        if (el('pvp-btn')) el('pvp-btn').onclick = () => { this.state.mode = 'pvp'; this.startSelect(); };
        if (el('custom-btn')) el('custom-btn').onclick = () => alert('DIY 功能：在控制台执行 window.addCustomGeneral(json)');
        if (el('confirm-select')) el('confirm-select').onclick = () => this.confirmSelect();
        if (el('end-turn')) el('end-turn').onclick = () => this.endTurn();
        if (el('restart-btn')) el('restart-btn').onclick = () => this.resetGame();
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
        const el = document.getElementById(id + '-screen');
        if (el) el.classList.add('active');
    },

    startSelect() {
        this.state.currentPlayer = 1;
        this.state.players[1].generals = [];
        this.state.players[2].generals = [];
        this.renderSelect();
        this.showScreen('select');
    },

    renderSelect() {
        const title = document.getElementById('select-title');
        const count = document.getElementById('select-count');
        const list = document.getElementById('generals-list');
        const confirm = document.getElementById('confirm-select');
        title.textContent = (this.state.currentPlayer === 1 ? '红方' : '蓝方') + ' 选将';
        const selected = this.state.players[this.state.currentPlayer].generals;
        count.textContent = selected.length + '/5';
        confirm.disabled = selected.length < 5;
        list.innerHTML = window.GENERALS.map((g) => {
            const isSel = selected.find((s) => s.id === g.id);
            return `<div class="general-card ${isSel ? 'selected' : ''}" data-id="${g.id}"><div class="general-icon">${g.name[0]}</div><div class="general-name">${g.name}</div></div>`;
        }).join('');
        list.querySelectorAll('.general-card').forEach((c) => {
            c.onclick = () => {
                const id = c.dataset.id;
                const generals = this.state.players[this.state.currentPlayer].generals;
                const idx = generals.findIndex((gg) => gg.id === id);
                if (idx >= 0) generals.splice(idx, 1);
                else if (generals.length < 5) generals.push({ ...window.GENERALS.find((gg) => gg.id === id) });
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

    startDeploy() {
        this.state.currentPlayer = 1;
        this.state.players[1].deployed = [];
        this.state.players[2].deployed = [];
        this.state.units = [];
        this.renderDeploy();
        this.showScreen('deploy');
    },

    renderDeploy() {
        const player = this.state.currentPlayer;
        document.getElementById('deploy-title').textContent = (player === 1 ? '红方' : '蓝方') + ' 布阵';
        const deployed = this.state.players[player].deployed;
        document.getElementById('deploy-count').textContent = deployed.length + '/5';
        const board = document.getElementById('deploy-board');
        board.innerHTML = '';
        for (let y = 0; y < window.BOARD_SIZE; y++) {
            for (let x = 0; x < window.BOARD_SIZE; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell ' + window.TERRAIN_NAMES[window.TERRAIN[y][x]];
                if (player === 1 && y >= window.BOARD_SIZE - 3) cell.classList.add('deploy-zone-p1');
                if (player === 2 && y <= 2) cell.classList.add('deploy-zone-p2');
                cell.dataset.x = x;
                cell.dataset.y = y;
                const label = window.TERRAIN_LABELS[window.TERRAIN[y][x]];
                if (label) cell.innerHTML = `<span class="terrain-label">${label}</span>`;
                const u = this.getUnit(x, y);
                if (u) {
                    cell.innerHTML += `<div class="unit p${u.player}"><div class="unit-icon">${u.name}</div></div>`;
                }
                cell.onclick = () => this.handleDeployClick(x, y);
                board.appendChild(cell);
            }
        }
        const generals = this.state.players[player].generals;
        document.getElementById('deploy-list').innerHTML = generals.map((g, i) => {
            const isDeployed = deployed.find((d) => d.generalId === g.id);
            return `<div class="mini-general ${isDeployed ? 'deployed' : ''}" data-idx="${i}">${g.name}</div>`;
        }).join('');
    },

    handleDeployClick(x, y) {
        const player = this.state.currentPlayer;
        if (player === 1 && y < window.BOARD_SIZE - 3) return;
        if (player === 2 && y > 2) return;
        if (this.getUnit(x, y)) return;
        const generals = this.state.players[player].generals;
        const deployed = this.state.players[player].deployed;
        const next = generals.find((g) => !deployed.find((d) => d.generalId === g.id));
        if (!next) return;
        this.createUnit(next, player, x, y);
        deployed.push({ generalId: next.id });
        if (deployed.length === 5) {
            if (player === 1) {
                this.state.currentPlayer = 2;
                this.renderDeploy();
            } else {
                this.startBattle();
            }
        } else {
            this.renderDeploy();
        }
    },

    startBattle() {
        this.state.units.forEach((u) => this.runPassive(u, 'init'));
        this.state.units.forEach((u) => {
            if (u.attackRangePlus) {
                const current = u.attackRange || '+1';
                const m = current.match(/^([+xr])(\d+)$/);
                if (m) u.attackRange = m[1] + (parseInt(m[2]) + u.attackRangePlus);
            }
        });
        this.state.currentPlayer = 1;
        this.state.turn = 1;
        this.state.selectedUnit = null;
        this.state.highlights = [];
        this.state.logs = ['战斗开始'];
        this.renderBattle();
        this.showScreen('battle');
    },

    createUnit(generalData, player, x, y) {
        const skills = window.SkillResolver.resolve(generalData.skillIds);
        const unit = {
            id: Date.now() + Math.random(),
            generalId: generalData.id,
            name: generalData.name,
            data: generalData,
            player,
            x,
            y,
            hp: generalData.hp,
            maxHp: generalData.hp,
            atk: generalData.atk,
            def: generalData.def,
            mov: generalData.mov,
            moveRange: generalData.moveRange || '+' + generalData.mov,
            attackRange: generalData.attackRange || '+1',
            energy: 0,
            skills,
            dead: false,
            moved: false,
            attacked: false,
            usedSkill: false,
            isSummon: false,
            originalHp: generalData.hp
        };
        this.state.units.push(unit);
        return unit;
    },

    runPassive(unit, trigger, context = {}) {
        if (!unit || unit.dead || !unit.skills) return [];
        const results = [];
        unit.skills.forEach((skill) => {
            if (skill.type !== 'passive' && !skill.passive) return;
            (skill.passive || []).forEach((p) => {
                if (p.trigger === trigger) {
                    const res = window.Effect.execute(p.effects, unit, context.target || null, this.state);
                    results.push(...(Array.isArray(res) ? res : [res]));
                }
            });
        });
        return results;
    },

    renderBattle() {
        document.getElementById('turn-info').textContent = `第${this.state.turn}回合 ${this.state.currentPlayer === 1 ? '红方' : '蓝方'}`;
        const board = document.getElementById('battle-board');
        board.innerHTML = '';
        for (let y = 0; y < window.BOARD_SIZE; y++) {
            for (let x = 0; x < window.BOARD_SIZE; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell ' + window.TERRAIN_NAMES[window.TERRAIN[y][x]];
                const hl = this.state.highlights.find((h) => h.x === x && h.y === y);
                if (hl) cell.classList.add('highlight-' + hl.type);
                cell.dataset.x = x;
                cell.dataset.y = y;
                const label = window.TERRAIN_LABELS[window.TERRAIN[y][x]];
                if (label) cell.innerHTML = `<span class="terrain-label">${label}</span>`;
                const u = this.getUnit(x, y);
                if (u) {
                    const hpPercent = ((u.hp / u.maxHp) * 100).toFixed(0);
                    const selected = this.state.selectedUnit && this.state.selectedUnit.id === u.id ? ' selected' : '';
                    cell.innerHTML += `<div class="unit p${u.player}${selected}"><div class="unit-icon">${u.name}</div><div class="unit-hp"><div class="unit-hp-fill" style="width:${hpPercent}%"></div></div></div>`;
                }
                cell.onclick = () => this.handleBattleClick(x, y);
                board.appendChild(cell);
            }
        }
        this.renderPlayerBars();
        this.renderSelectedSkills();
        const logPanel = document.getElementById('log-panel');
        if (logPanel) logPanel.innerHTML = this.state.logs.slice(-10).map((l) => `<div class="log-entry">${l}</div>`).join('');
    },

    renderPlayerBars() {
        [1, 2].forEach((player) => {
            const bar = document.getElementById(`player${player}-generals`);
            if (!bar) return;
            const units = this.state.units.filter((u) => u.player === player && !u.dead);
            bar.innerHTML = units.map((u) => {
                const hpPercent = ((u.hp / u.maxHp) * 100).toFixed(0);
                return `<div class="bar-general ${u.dead ? 'dead' : ''}"><span class="bar-general-name">${u.name}</span><div class="bar-general-hp"><div class="bar-general-hp-fill" style="width:${hpPercent}%"></div></div><span class="bar-general-energy">${u.energy}</span></div>`;
            }).join('');
        });
    },

    renderSelectedSkills() {
        const container = document.getElementById('selected-info');
        if (!container) return;
        const u = this.state.selectedUnit;
        if (!u) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');
        const activeSkills = u.skills.filter((s) => s.type === 'active');
        container.innerHTML = activeSkills.map((s) => {
            const cost = s.energyCost || 0;
            const disabled = (cost > 0 && u.energy < cost) || u.usedSkill || u.silenced;
            return `<button class="sel-skill-btn ${disabled ? 'disabled' : ''}" data-skill="${s.id}" title="${s.desc || ''}">${s.name}${cost ? '(' + cost + '能)' : ''}</button>`;
        }).join('') || '<span>无主动技能</span>';
        container.querySelectorAll('.sel-skill-btn').forEach((btn) => {
            btn.onclick = () => {
                if (btn.classList.contains('disabled')) return;
                const skill = u.skills.find((s) => s.id === btn.dataset.skill);
                this.selectSkill(skill);
            };
        });
    },

    handleBattleClick(x, y) {
        const unit = this.getUnit(x, y);
        const hl = this.state.highlights.find((h) => h.x === x && h.y === y);

        if (this.state.skillPhase === 'step2' && this.state.currentSkill) {
            if (hl && hl.type === 'skill') {
                this.executeStep2Skill(x, y);
                return;
            }
            this.cancelSkill();
            this.renderBattle();
            return;
        }

        if (this.state.skillPhase === 'step1' && this.state.currentSkill) {
            if (hl && hl.type === 'skill' && unit) {
                this.executeStep1Target(x, y, unit);
                return;
            }
            this.cancelSkill();
            this.renderBattle();
            return;
        }

        if (hl && hl.type === 'move' && this.state.selectedUnit) {
            this.executeMove(this.state.selectedUnit, x, y);
            return;
        }

        if (hl && hl.type === 'attack' && this.state.selectedUnit && unit && unit.player !== this.state.selectedUnit.player) {
            this.executeAttack(this.state.selectedUnit, unit);
            return;
        }

        if (hl && hl.type === 'skill' && this.state.selectedUnit && this.state.currentSkill) {
            this.executeSkillOnCell(x, y, unit);
            return;
        }

        if (unit && unit.player === this.state.currentPlayer) {
            if (unit.stunned) {
                this.state.logs.push(unit.name + '处于眩晕状态');
                return;
            }
            this.state.selectedUnit = unit;
            this.cancelSkill();
            this.showMovesAndAttacks(unit);
            this.renderBattle();
            return;
        }

        this.state.selectedUnit = null;
        this.cancelSkill();
        this.renderBattle();
    },

    executeMove(unit, x, y) {
        unit.x = x;
        unit.y = y;
        unit.moved = true;
        this.runPassive(unit, 'afterMove');
        this.runPassive(unit, 'afterAction');
        this.clearHighlights();
        this.state.logs.push(unit.name + '移动');
        this.showMovesAndAttacks(unit);
        this.renderBattle();
    },

    executeAttack(attacker, target) {
        const results = window.Effect.execute(
            [{ effectKey: 'damage', targetType: 'target', params: { amount: attacker.atk } }],
            attacker,
            target,
            this.state
        );
        attacker.attacked = true;
        this.runPassive(attacker, 'afterAttack');
        this.runPassive(attacker, 'afterAction');
        if (target.dead) {
            this.state.logs.push(`${attacker.name} 击杀 ${target.name}`);
            this.runPassive(attacker, 'onKill', { target, killed: true });
        } else {
            this.state.logs.push(`${attacker.name} 攻击 ${target.name} -${results[0] && results[0].amount}`);
        }
        if (target.counterRate && !target.dead && Math.random() < target.counterRate) {
            const counterDmg = Math.max(1, Math.floor(target.atk * 0.5 - attacker.def * 0.3));
            attacker.hp -= counterDmg;
            if (attacker.hp <= 0) {
                attacker.hp = 0;
                attacker.dead = true;
            }
            this.state.logs.push(`${target.name} 反击 ${attacker.name} -${counterDmg}`);
            this.showFloat(attacker.x, attacker.y, `-${counterDmg}`, 'damage');
        }
        this.showFloat(target.x, target.y, `-${results[0] ? results[0].amount : 0}`, 'damage');
        this.clearHighlights();
        this.checkWin();
        this.renderBattle();
    },

    selectSkill(skill) {
        this.state.currentSkill = skill;
        this.clearHighlights();
        const u = this.state.selectedUnit;
        if (skill.selectStep1 === 'enemy') {
            this.state.skillPhase = 'step1';
            const range = skill.selectStep1Range || skill.range;
            this.highlightTargetCells(range, 'enemy');
            this.renderBattle();
            return;
        }
        this.state.skillPhase = null;
        if (skill.category === 'summon') {
            this.highlightEmpty(skill.range);
        } else if (skill.category === 'buff') {
            this.highlightTargetCells(skill.range, 'ally');
        } else {
            this.highlightTargetCells(skill.range, 'enemy');
        }
        this.renderBattle();
    },

    highlightTargetCells(rangeStr, side) {
        const cells = window.Range.parse(rangeStr, this.state.selectedUnit.x, this.state.selectedUnit.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
        cells.forEach((p) => {
            const u = this.getUnit(p.x, p.y);
            if (side === 'enemy' && u && u.player !== this.state.selectedUnit.player && !u.dead) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            if (side === 'ally' && u && u.player === this.state.selectedUnit.player && !u.dead) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
        });
    },

    highlightEmpty(rangeStr) {
        const cells = window.Range.parse(rangeStr, this.state.selectedUnit.x, this.state.selectedUnit.y, window.BLOCKING_TERRAIN_MOVE, window.TERRAIN);
        cells.forEach((p) => {
            if (!this.getUnit(p.x, p.y) && !window.BLOCKING_TERRAIN_MOVE.has(window.TERRAIN[p.y][p.x])) {
                this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            }
        });
    },

    executeSkillOnCell(x, y, unit) {
        const skill = this.state.currentSkill;
        const caster = this.state.selectedUnit;
        if (skill.energyCost) caster.energy -= skill.energyCost;
        const replacedEffects = (skill.effects || []).map((e) => {
            if (!e.params) return e;
            const p = { ...e.params };
            if (p.x === '__targetX__') p.x = x;
            if (p.y === '__targetY__') p.y = y;
            return { ...e, params: p };
        });
        const target = unit || { x, y };
        const results = window.Effect.execute(replacedEffects, caster, target, this.state);
        caster.usedSkill = true;
        results.forEach((r) => {
            if (r.targetId) {
                const killedUnit = this.state.units.find((uu) => uu.id === r.targetId);
                if (killedUnit && killedUnit.dead) {
                    this.state.logs.push(`${caster.name} 击杀 ${killedUnit.name}`);
                    this.runPassive(caster, 'onKill', { target: killedUnit, killed: true });
                }
            }
        });
        this.runPassive(caster, 'afterAction');
        this.state.logs.push(`${caster.name} 使用 ${skill.name}`);
        this.cancelSkill();
        this.checkWin();
        this.renderBattle();
    },

    executeStep1Target(x, y, unit) {
        this.state.skillStep1Target = unit;
        this.state.skillPhase = 'step2';
        this.clearHighlights();
        const skill = this.state.currentSkill;
        const range = window.Range.parse(skill.selectStep2Range, unit.x, unit.y, null, window.TERRAIN);
        range.forEach((p) => {
            if (!this.getUnit(p.x, p.y) && !window.BLOCKING_TERRAIN_MOVE.has(window.TERRAIN[p.y][p.x])) {
                this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            }
        });
        this.renderBattle();
    },

    executeStep2Skill(x, y) {
        const skill = this.state.currentSkill;
        const caster = this.state.selectedUnit;
        const target = this.state.skillStep1Target;
        if (skill.energyCost) caster.energy -= skill.energyCost;
        const replacedEffects = (skill.effects || []).map((e) => {
            if (!e.params) return e;
            const p = { ...e.params };
            if (p.x === '__landingX__') p.x = x;
            if (p.y === '__landingY__') p.y = y;
            return { ...e, params: p };
        });
        const results = window.Effect.execute(replacedEffects, caster, target, this.state);
        caster.usedSkill = true;
        results.forEach((r) => {
            if (r.targetId) {
                const killed = this.state.units.find((uu) => uu.id === r.targetId);
                if (killed && killed.dead) {
                    this.state.logs.push(`${caster.name} 击杀 ${killed.name}`);
                    this.runPassive(caster, 'onKill', { target: killed, killed: true });
                }
            }
        });
        this.runPassive(caster, 'afterAction');
        this.state.logs.push(`${caster.name} 使用 ${skill.name}`);
        this.cancelSkill();
        this.checkWin();
        this.renderBattle();
    },

    cancelSkill() {
        this.state.currentSkill = null;
        this.state.skillPhase = null;
        this.state.skillStep1Target = null;
        this.clearHighlights();
    },

    showMovesAndAttacks(unit) {
        this.clearHighlights();
        const blockedMove = new Set();
        this.state.units.forEach((u) => {
            if (!u.dead) blockedMove.add(u.x + ',' + u.y);
        });
        if (!unit.moved) {
            const cells = window.Range.parseBlocked(unit.moveRange, unit.x, unit.y, blockedMove, window.BLOCKING_TERRAIN_MOVE, window.TERRAIN);
            cells.forEach((p) => {
                if (!this.getUnit(p.x, p.y)) this.state.highlights.push({ x: p.x, y: p.y, type: 'move' });
            });
        }
        if (!unit.attacked) {
            const cells = window.Range.parse(unit.attackRange, unit.x, unit.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
            cells.forEach((p) => {
                const u = this.getUnit(p.x, p.y);
                if (u && u.player !== unit.player && !u.dead) {
                    this.state.highlights.push({ x: p.x, y: p.y, type: 'attack' });
                }
            });
        }
    },

    clearHighlights() {
        this.state.highlights = [];
    },

    endTurn() {
        this.state.units.forEach((u) => {
            if (u.player === this.state.currentPlayer) {
                window.Effect.tickDebuffs(u, this.state);
                window.Effect.tickBuffs(u, this.state);
            }
        });
        this.state.currentPlayer = this.state.currentPlayer === 1 ? 2 : 1;
        if (this.state.currentPlayer === 1) this.state.turn++;
        this.state.units.forEach((u) => {
            if (u.player === this.state.currentPlayer && !u.dead) {
                u.moved = false;
                u.attacked = false;
                u.usedSkill = false;
                this.runPassive(u, 'onTurnStart');
            }
        });
        this.state.units.forEach((u) => {
            if (u.player !== this.state.currentPlayer || u.dead) return;
            (u.skills || []).forEach((s) => {
                if (s.type === 'active' && s.chargeTrigger === 'onTurn') {
                    u.energy = (u.energy || 0) + 1;
                }
            });
        });
        this.checkWin();
        this.state.selectedUnit = null;
        this.cancelSkill();
        this.renderBattle();
    },

    showFloat(x, y, text, type) {
        const cell = document.querySelector(`#battle-board .cell[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        const el = document.createElement('div');
        el.className = 'float-text ' + type;
        el.textContent = text;
        cell.appendChild(el);
        setTimeout(() => el.remove(), 800);
    },

    getUnit(x, y) {
        return this.state.units.find((u) => u.x === x && u.y === y && !u.dead);
    },

    checkWin() {
        const p1 = this.state.units.filter((u) => u.player === 1 && !u.dead && u.generalId);
        const p2 = this.state.units.filter((u) => u.player === 2 && !u.dead && u.generalId);
        if (p1.length === 0) this.endGame(2);
        else if (p2.length === 0) this.endGame(1);
    },

    endGame(winner) {
        document.getElementById('winner-text').textContent = (winner === 1 ? '红方' : '蓝方') + ' 胜利！';
        this.showScreen('gameover');
    },

    resetGame() {
        this.state = {
            mode: 'pvp',
            currentPlayer: 1,
            turn: 1,
            selectedUnit: null,
            currentSkill: null,
            skillPhase: null,
            skillStep1Target: null,
            highlights: [],
            logs: [],
            units: [],
            players: { 1: { generals: [], deployed: [] }, 2: { generals: [], deployed: [] } }
        };
        this.showScreen('menu');
    }
};

window.Game = Game;

window.addCustomSkill = function (skillDef) {
    if (!skillDef || !skillDef.id) return console.error('addCustomSkill: 需要 id');
    window.SKILLS[skillDef.id] = skillDef;
    console.log('[DIY] 已注册技能', skillDef.id);
};

window.addCustomGeneral = function (generalDef) {
    if (!generalDef || !generalDef.id) return console.error('addCustomGeneral: 需要 id');
    window.GENERALS.push(generalDef);
    console.log('[DIY] 已注册武将', generalDef.id);
};

document.addEventListener('DOMContentLoaded', () => Game.init());
