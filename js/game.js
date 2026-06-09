// ================================
// 游戏逻辑
// ================================

// 确保全局 Effect 对象存在 —— 若 effect.js 加载失败/缓存过期，使用兜底实现
(function ensureEffect() {
    if (!window.Effect || typeof window.Effect !== 'object') {
        window.Effect = {};
    }
    const fallback = {
        damage(a, t, v) {
            const dmg = Math.max(1, Math.floor((v || 10) - (t.def || 0) * 0.3));
            t.hp -= dmg;
            if (t.hp <= 0) { t.hp = 0; t.dead = true; }
            let counter = null;
            if (t.counterRate && !t.dead && Math.random() < t.counterRate) {
                const cd = Math.max(1, Math.floor((t.atk || 0) * 0.5 - (a.def || 0) * 0.3));
                a.hp -= cd;
                if (a.hp <= 0) { a.hp = 0; a.dead = true; }
                counter = cd;
            }
            return { damage: dmg, type: 'damage', counter };
        },
        heal(t, v) { t.hp = Math.min(t.maxHp, t.hp + v); return { heal: v, type: 'heal' }; },
        aoe(a, list, v, gs) {
            let total = 0; const details = [];
            list.forEach(e => { if (!e.dead) { const r = this.damage(a, e, v); total += r.damage; details.push({ name: e.name, ...r }); } });
            return { damage: total, type: 'aoe', targets: details };
        },
        pierce(a, tx, ty, v, gs) {
            const dx = Math.sign(tx - a.x) || 1, dy = Math.sign(ty - a.y) || 0;
            let total = 0; const details = [];
            for (let i = 1; i <= (window.BOARD_SIZE || 12); i++) {
                const nx = a.x + dx * i, ny = a.y + dy * i;
                if (nx < 0 || ny < 0 || nx >= (window.BOARD_SIZE || 12) || ny >= (window.BOARD_SIZE || 12)) break;
                const hit = gs.units.find(u => u.x === nx && u.y === ny && !u.dead && u.player !== a.player);
                if (hit) { const r = this.damage(a, hit, v); total += r.damage; details.push({ name: hit.name, ...r }); }
            }
            return { damage: total, type: 'pierce', targets: details };
        },
        summon(a, x, y, kind, gs) {
            const sd = (window.SUMMONS || {})[kind];
            if (!sd) return null;
            const unit = { id: Math.random(), name: sd.name, player: a.player, x, y, hp: sd.hp, maxHp: sd.hp, atk: sd.atk, def: sd.def, mov: sd.mov, moveRange: '+' + sd.mov, attackRange: '+1', energy: 0, skills: [], dead: false, isSummon: true };
            gs.units.push(unit);
            return { unit, type: 'summon' };
        },
        move(u, x, y) { u.x = x; u.y = y; return { type: 'move', x, y }; },
        poison(t, v, turns) { if (!t.debuffs) t.debuffs = []; t.debuffs.push({ type: 'poison', damage: v, turns: turns || 3 }); return { type: 'poison', damage: v, turns: turns || 3 }; },
        stun(t, turns) { if (!t.debuffs) t.debuffs = []; t.debuffs.push({ type: 'stun', turns: turns || 1 }); t.stunned = turns || 1; return { type: 'stun', turns: turns || 1 }; },
        slow(t, amt, turns) { if (!t.debuffs) t.debuffs = []; t.debuffs.push({ type: 'slow', amount: amt, turns: turns || 2, originalMov: t.mov }); t.mov = Math.max(1, t.mov - amt); return { type: 'slow', amount: amt, turns: turns || 2 }; },
        burn(t, v, turns) { if (!t.debuffs) t.debuffs = []; t.debuffs.push({ type: 'burn', damage: v, turns: turns || 2 }); return { type: 'burn', damage: v, turns: turns || 2 }; },
        confuse(t, turns) { if (!t.debuffs) t.debuffs = []; t.debuffs.push({ type: 'confuse', turns: turns || 1 }); t.confused = turns || 1; return { type: 'confuse', turns: turns || 1 }; },
        silence(t, turns) { if (!t.debuffs) t.debuffs = []; t.debuffs.push({ type: 'silence', turns: turns || 1 }); t.silenced = turns || 1; return { type: 'silence', turns: turns || 1 }; },
        shredDef(t, v, turns) { if (!t.debuffs) t.debuffs = []; t.debuffs.push({ type: 'shredDef', value: v, turns: turns || 1, originalDef: t.def }); t.def = Math.max(0, t.def - v); return { type: 'shredDef', value: v, turns: turns || 1 }; },
        grantExtraAction(t) { t.moved = false; t.attacked = false; return { type: 'extraAction' }; },
        applyPassiveFlags(u, list) { (list || []).forEach(e => { if (e.flag) u[e.flag] = e.value; if (e.stat && typeof e.modify === 'number') u[e.stat] = (u[e.stat] || 0) + e.modify; }); }
    };
    Object.keys(fallback).forEach(k => {
        if (!window.Effect[k] || typeof window.Effect[k] !== 'function') window.Effect[k] = fallback[k].bind(window.Effect);
    });
})();

// 确保全局 Range 对象存在
(function ensureRange() {
    if (!window.Range || typeof window.Range !== 'object') window.Range = {};
    const fallbackRange = {
        _buildPlus(size, cx, cy) {
            const cells = [];
            for (let i = 1; i <= size; i++) {
                cells.push({ x: cx + i, y: cy }, { x: cx - i, y: cy });
                cells.push({ x: cx, y: cy + i }, { x: cx, y: cy - i });
            }
            return cells;
        },
        _buildX(size, cx, cy) {
            const cells = [];
            for (let i = 1; i <= size; i++) {
                cells.push({ x: cx + i, y: cy + i }, { x: cx - i, y: cy + i });
                cells.push({ x: cx + i, y: cy - i }, { x: cx - i, y: cy - i });
            }
            return cells;
        },
        _buildR(size, cx, cy) {
            const cells = [];
            for (let dy = -size; dy <= size; dy++) {
                for (let dx = -size; dx <= size; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (Math.abs(dx) + Math.abs(dy) <= size) cells.push({ x: cx + dx, y: cy + dy });
                }
            }
            return cells;
        },
        parse(spec, cx, cy, blocking, terrain) {
            if (!spec) return [];
            if (Array.isArray(spec)) {
                const arr = [];
                spec.forEach(s => arr.push(...this.parse(s, cx, cy, blocking, terrain)));
                return arr;
            }
            let cells = [];
            const m = String(spec).match(/^([+xr])(\d+)$/);
            if (!m) return [];
            const kind = m[1], size = parseInt(m[2]);
            if (kind === '+') cells = this._buildPlus(size, cx, cy);
            if (kind === 'x') cells = this._buildX(size, cx, cy);
            if (kind === 'r') cells = this._buildR(size, cx, cy);
            const BS = window.BOARD_SIZE || 12;
            return cells.filter(c => c.x >= 0 && c.x < BS && c.y >= 0 && c.y < BS);
        },
        parseBlocked(spec, cx, cy, blockedSet, blockingTerrain, terrain) {
            const raw = this.parse(spec, cx, cy, blockingTerrain, terrain);
            if (!blockingTerrain && !blockedSet) return raw;
            const BS = window.BOARD_SIZE || 12;
            return raw.filter(c => {
                if (c.x < 0 || c.x >= BS || c.y < 0 || c.y >= BS) return false;
                if (blockingTerrain && terrain && terrain[c.y] && blockingTerrain.has(terrain[c.y][c.x])) return false;
                if (blockedSet && blockedSet.has(c.x + ',' + c.y)) return false;
                return true;
            });
        }
    };
    ['_buildPlus', '_buildX', '_buildR', 'parse', 'parseBlocked'].forEach(k => {
        if (!window.Range[k] || typeof window.Range[k] !== 'function') window.Range[k] = fallbackRange[k].bind(window.Range);
    });
})();

const Game = {
    state: {
        mode: 'pvp',
        currentPlayer: 1,
        turn: 1,
        selectedUnit: null,
        currentSkill: null,
        skillPhase: null,
        skillTarget: null,
        highlights: [],
        logs: [],
        units: [],
        players: {
            1: { generals: [], deployed: [], toDeploy: null },
            2: { generals: [], deployed: [], toDeploy: null }
        }
    },

    init() {
        console.log('[Game] init called');
        console.log('[Game] window.Effect:', window.Effect);
        console.log('[Game] window.Range:', window.Range);
        this.bindEvents();
        this.showScreen('menu');
        console.log('[Game] init done');
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const s = document.getElementById(screenId + '-screen');
        if (s) s.classList.add('active');
    },

    bindEvents() {
        const pvpBtn = document.getElementById('pvp-btn');
        const pveBtn = document.getElementById('pve-btn');
        const customBtn = document.getElementById('custom-btn');

        if (pvpBtn) pvpBtn.addEventListener('click', () => { this.state.mode = 'pvp'; this.startSelect(); });
        if (pveBtn) pveBtn.addEventListener('click', () => { this.state.mode = 'pve'; this.startSelect(); });
        if (customBtn) customBtn.addEventListener('click', () => alert('DIY武将功能即将开放！'));

        const confirmSelect = document.getElementById('confirm-select');
        const endTurn = document.getElementById('end-turn');
        const restartBtn = document.getElementById('restart-btn');
        const closeDetail = document.getElementById('close-detail');

        if (confirmSelect) confirmSelect.addEventListener('click', () => this.confirmSelect());
        if (endTurn) endTurn.addEventListener('click', () => this.endTurn());
        if (restartBtn) restartBtn.addEventListener('click', () => this.resetGame());
        if (closeDetail) closeDetail.addEventListener('click', () => this.hideDetail());

        const wSlider = document.getElementById('cell-width');
        const hSlider = document.getElementById('cell-height');
        if (wSlider) {
            wSlider.oninput = (e) => {
                document.getElementById('cell-width-val').textContent = e.target.value;
                document.documentElement.style.setProperty('--cell-w', e.target.value + 'px');
            };
        }
        if (hSlider) {
            hSlider.oninput = (e) => {
                document.getElementById('cell-height-val').textContent = e.target.value;
                document.documentElement.style.setProperty('--cell-h', e.target.value + 'px');
            };
        }
    },

    // ========================================
    // 选将阶段
    // ========================================
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

        list.innerHTML = window.GENERALS.map(g => {
            const isSelected = selected.find(s => s.id === g.id);
            const isOppSelected = this.state.players[this.state.currentPlayer === 1 ? 2 : 1].generals.find(s => s.id === g.id);
            return `
                <div class="general-card ${isSelected ? 'selected' : ''}" data-id="${g.id}" style="opacity:${isOppSelected ? '0.2' : '1'}">
                    <span class="info-btn" data-id="${g.id}">i</span>
                    <div class="general-icon">${g.name[0]}</div>
                    <div class="general-name">${g.name}</div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.general-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.classList.contains('info-btn')) return;
                const id = e.currentTarget.dataset.id;
                const opponentSelected = this.state.players[this.state.currentPlayer === 1 ? 2 : 1].generals.find(s => s.id === id);
                if (opponentSelected) return;
                const generals = this.state.players[this.state.currentPlayer].generals;
                const idx = generals.findIndex(gg => gg.id === id);
                if (idx >= 0) generals.splice(idx, 1);
                else if (generals.length < 5) generals.push({ ...window.GENERALS.find(gg => gg.id === id) });
                this.renderSelect();
            };
        });

        list.querySelectorAll('.info-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                const g = window.GENERALS.find(gg => gg.id === id);
                if (g) {
                    const skillsDesc = g.skills.map(s => `${s.name}(${s.type === 'passive' ? '被动' : '主动'}${s.energyCost ? ' 能量:' + s.energyCost : ''}): ${s.desc}`).join('\n');
                    alert(`${g.name}\nHP: ${g.hp} | 攻: ${g.atk} | 防: ${g.def} | 移: ${g.mov}\n移动范围: ${g.moveRange}\n攻击范围: ${g.attackRange}\n\n技能:\n${skillsDesc}`);
                }
            };
        });
    },

    confirmSelect() {
        if (this.state.currentPlayer === 1) {
            this.state.currentPlayer = 2;
            if (this.state.mode === 'pve') {
                const available = window.GENERALS.filter(g => !this.state.players[1].generals.find(p => p.id === g.id));
                for (let i = 0; i < 5; i++) {
                    const idx = Math.floor(Math.random() * available.length);
                    this.state.players[2].generals.push({ ...available[idx] });
                    available.splice(idx, 1);
                }
                this.startDeploy();
            } else {
                this.renderSelect();
            }
        } else {
            this.startDeploy();
        }
    },

    // ========================================
    // 布阵阶段
    // ========================================
    startDeploy() {
        this.state.currentPlayer = 1;
        this.state.players[1].deployed = [];
        this.state.players[2].deployed = [];
        this.state.units = [];
        this.state.players[1].toDeploy = null;
        this.state.players[2].toDeploy = null;
        this.renderDeploy();
        this.showScreen('deploy');
    },

    renderDeploy() {
        const title = document.getElementById('deploy-title');
        const count = document.getElementById('deploy-count');
        const board = document.getElementById('deploy-board');
        const list = document.getElementById('deploy-list');

        const player = this.state.currentPlayer;
        const generals = this.state.players[player].generals;
        const deployed = this.state.players[player].deployed;

        title.textContent = (player === 1 ? '红方' : '蓝方') + ' 布阵';
        count.textContent = deployed.length + '/5';

        board.innerHTML = '';
        for (let y = 0; y < window.BOARD_SIZE; y++) {
            for (let x = 0; x < window.BOARD_SIZE; x++) {
                const terrainId = window.TERRAIN[y][x];
                const terrain = window.TERRAIN_NAMES[terrainId];
                const terrainLabel = window.TERRAIN_LABELS[terrainId];
                const unit = this.getUnit(x, y);
                let cellClass = 'cell ' + terrain;
                if (player === 1 && y >= window.BOARD_SIZE - 3) cellClass += ' deploy-zone-p1';
                if (player === 2 && y <= 2) cellClass += ' deploy-zone-p2';
                const cell = document.createElement('div');
                cell.className = cellClass;
                cell.dataset.x = x;
                cell.dataset.y = y;
                let html = '';
                if (x === 0) html += `<span class="cell-label top-left">${y}</span>`;
                if (y === window.BOARD_SIZE - 1) html += `<span class="cell-label bottom-left">${x}</span>`;
                if (terrainLabel) html += `<span class="terrain-label" style="font-size:24px;opacity:0.7">${terrainLabel}</span>`;
                if (unit) html += this.renderUnit(unit);
                cell.innerHTML = html;
                cell.onclick = () => this.handleDeployClick(x, y);
                board.appendChild(cell);
            }
        }

        list.innerHTML = generals.map((g, idx) => {
            const isDeployed = deployed.find(d => d.generalId === g.id);
            const isActive = this.state.players[player].toDeploy === idx && !isDeployed;
            return `<div class="mini-general ${isActive ? 'active' : ''} ${isDeployed ? 'deployed' : ''}" data-idx="${idx}">${g.name}</div>`;
        }).join('');

        list.querySelectorAll('.mini-general').forEach(el => {
            el.onclick = (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                const g = generals[idx];
                const isDeployed = deployed.find(d => d.generalId === g.id);
                if (!isDeployed) {
                    this.state.players[player].toDeploy = idx;
                    this.renderDeploy();
                }
            };
        });
    },

    handleDeployClick(x, y) {
        const player = this.state.currentPlayer;
        if (player === 1 && y < window.BOARD_SIZE - 3) return;
        if (player === 2 && y > 2) return;
        if (this.getUnit(x, y)) return;

        const generals = this.state.players[player].generals;
        const deployed = this.state.players[player].deployed;
        let generalIdx = this.state.players[player].toDeploy;
        if (generalIdx === null || generalIdx === undefined) {
            for (let i = 0; i < 5; i++) {
                if (!deployed.find(d => d.generalId === generals[i].id)) { generalIdx = i; break; }
            }
        }
        if (generalIdx === null || generalIdx === undefined || generalIdx < 0) return;
        if (deployed.find(d => d.generalId === generals[generalIdx].id)) return;

        const general = generals[generalIdx];
        const unit = {
            id: Date.now() + Math.random(),
            generalId: general.id,
            generalData: general,
            name: general.name,
            player: player,
            x, y,
            hp: general.hp, maxHp: general.hp,
            atk: general.atk, def: general.def, mov: general.mov,
            moveRange: general.moveRange || '+' + general.mov,
            attackRange: general.attackRange || '+1',
            energy: 0,
            skills: general.skills ? [...general.skills] : [],
            dead: false, moved: false, attacked: false, usedSkill: false
        };
        this.state.units.push(unit);
        deployed.push({ generalId: general.id, unitId: unit.id });
        this.state.players[player].toDeploy = null;

        if (deployed.length === 5) {
            if (player === 1) {
                this.state.currentPlayer = 2;
                if (this.state.mode === 'pve') this.deployAI();
                else this.renderDeploy();
            } else {
                this.startBattle();
            }
        } else {
            this.renderDeploy();
        }
    },

    deployAI() {
        const available = [];
        for (let y = 0; y <= 2; y++) {
            for (let x = 0; x < window.BOARD_SIZE; x++) {
                if (!this.getUnit(x, y)) available.push({ x, y });
            }
        }
        this.state.players[2].generals.forEach((g) => {
            const posIdx = Math.floor(Math.random() * available.length);
            const pos = available[posIdx];
            available.splice(posIdx, 1);
            const unit = {
                id: Date.now() + Math.random(),
                generalId: g.id, generalData: g,
                name: g.name, player: 2,
                x: pos.x, y: pos.y,
                hp: g.hp, maxHp: g.hp,
                atk: g.atk, def: g.def, mov: g.mov,
                moveRange: g.moveRange || '+' + g.mov,
                attackRange: g.attackRange || '+1',
                energy: 0,
                skills: g.skills ? [...g.skills] : [],
                dead: false, moved: false, attacked: false, usedSkill: false
            };
            this.state.units.push(unit);
            this.state.players[2].deployed.push({ generalId: g.id, unitId: unit.id });
        });
        this.startBattle();
    },

    // ========================================
    // 战斗阶段
    // ========================================
    startBattle() {
        // 初始化被动技能效果
        this.state.units.forEach(u => this.initPassiveSkills(u));

        this.state.currentPlayer = 1;
        this.state.turn = 1;
        this.state.selectedUnit = null;
        this.state.currentSkill = null;
        this.state.skillPhase = null;
        this.state.skillTarget = null;
        this.state.highlights = [];
        this.state.logs = ['战斗开始'];
        this.renderBattle();
        this.showScreen('battle');
    },

    initPassiveSkills(unit) {
        if (!unit.skills) return;
        const passive = unit.skills.filter(s => s.type === 'passive');
        passive.forEach(s => {
            if (s.id === 'changSheng') unit._passive_changSheng = true;
            if (s.id === 'weiLin') unit._passive_weiLin = true;
            if (s.id === 'jianXiong') unit._passive_jianXiong = true;
            if (s.id === 'guanChuan') unit._passive_guanChuan = true;
            if (s.id === 'longMao') unit._passive_longMao = true;
            if (s.id === 'shenSu') {
                unit.mov = unit.mov + 1;
                unit.attackRange = '+2';
            }
            if (s.id === 'lieGong') unit.attackRange = '+5';
            if (s.id === 'tiandi') unit._passive_tianTi = true;
            if (s.id === 'kuangluan') unit._passive_kuangLuan = true;
            if (s.id === 'wushuang') {
                unit.atk = unit.atk + 20;
                unit.counterRate = 0.3;
            }
        });
    },

    renderBattle() {
        const info = document.getElementById('turn-info');
        const board = document.getElementById('battle-board');
        const log = document.getElementById('log-panel');

        if (info) info.textContent = '第' + this.state.turn + '回合 ' + (this.state.currentPlayer === 1 ? '红方' : '蓝方');

        if (board) {
            board.innerHTML = '';
            for (let y = 0; y < window.BOARD_SIZE; y++) {
                for (let x = 0; x < window.BOARD_SIZE; x++) {
                    const terrainId = window.TERRAIN[y][x];
                    const terrain = window.TERRAIN_NAMES[terrainId];
                    const terrainLabel = window.TERRAIN_LABELS[terrainId];
                    const unit = this.getUnit(x, y);
                    const hl = this.state.highlights.find(h => h.x === x && h.y === y);
                    let cellClass = 'cell ' + terrain;
                    if (hl) cellClass += ' highlight-' + hl.type;
                    const cell = document.createElement('div');
                    cell.className = cellClass;
                    cell.dataset.x = x;
                    cell.dataset.y = y;
                    let html = '';
                    if (x === 0) html += `<span class="cell-label top-left">${y}</span>`;
                    if (y === window.BOARD_SIZE - 1) html += `<span class="cell-label bottom-left">${x}</span>`;
                    if (terrainLabel) html += `<span class="terrain-label" style="font-size:24px;opacity:0.7">${terrainLabel}</span>`;
                    if (unit) html += this.renderUnit(unit);
                    cell.innerHTML = html;
                    cell.onclick = () => this.handleBattleClick(x, y);
                    board.appendChild(cell);
                }
            }
        }

        this.renderPlayerBars();
        this.renderSelectedSkills();

        if (log) log.innerHTML = this.state.logs.slice(-8).map(l => `<div class="log-entry">${l}</div>`).join('');
    },

    renderSelectedSkills() {
        const container = document.getElementById('selected-info');
        if (!container) return;
        const u = this.state.selectedUnit;
        if (!u) { container.classList.add('hidden'); return; }
        container.classList.remove('hidden');
        const skills = u.skills || [];
        const activeSkills = skills.filter(s => s.type === 'active');
        const passiveSkills = skills.filter(s => s.type === 'passive');

        container.innerHTML = `
            <div class="sel-info-skills">
                ${activeSkills.map(s => {
                    const isCharged = s.energyCost !== undefined;
                    const canUse = (!isCharged || u.energy >= s.energyCost) && !u.usedSkill && !u.silenced;
                    const label = u.silenced ? s.name + '(沉默)' : (isCharged ? s.name + '(' + s.energyCost + '能量)' : s.name);
                    return `
                        <div class="sel-skill-wrap">
                            <button class="sel-skill-btn ${canUse ? 'available' : 'unavailable'}" data-skill="${s.id}">${label}</button>
                            <span class="sel-skill-info" data-skill="${s.id}">i</span>
                        </div>
                    `;
                }).join('')}
                ${passiveSkills.map(s => `
                    <div class="sel-skill-wrap">
                        <span class="sel-passive">${s.name}</span>
                        <span class="sel-skill-info" data-skill="${s.id}">i</span>
                    </div>
                `).join('')}
            </div>
        `;

        container.querySelectorAll('.sel-skill-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const sid = e.currentTarget.dataset.skill;
                const skill = u.skills.find(s => s.id === sid);
                const isCharged = skill.energyCost !== undefined;
                if (u.silenced) { this.state.logs.push(u.name + ' 处于沉默状态，无法使用技能'); return; }
                if (skill && (!isCharged || u.energy >= skill.energyCost) && !u.usedSkill) this.selectSkill(skill);
            };
        });

        container.querySelectorAll('.sel-skill-info').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                const sid = e.currentTarget.dataset.skill;
                const skill = u.skills.find(s => s.id === sid);
                if (skill) alert(skill.name + '\n类型: ' + (skill.type === 'passive' ? '被动' : '主动') + '\n范围: ' + (skill.range || '-') + '\n能量: ' + (skill.energyCost || 0) + '\n' + skill.desc);
            };
        });
    },

    renderPlayerBars() {
        const p1Bar = document.getElementById('player1-generals');
        const p2Bar = document.getElementById('player2-generals');
        if (!p1Bar || !p2Bar) return;

        const renderBar = (player, container) => {
            const units = this.state.units.filter(u => u.player === player && !u.dead);
            container.innerHTML = units.map(u => {
                const hpPercent = (u.hp / u.maxHp * 100).toFixed(0);
                const isSummon = u.isSummon ? ' summon' : '';
                return `
                    <div class="bar-general ${u.dead ? 'dead' : ''} p${player}${isSummon}" data-unit-id="${u.id}">
                        <span class="bar-general-name">${u.name}</span>
                        <div class="bar-general-hp"><div class="bar-general-hp-fill" style="width:${hpPercent}%"></div></div>
                        <span class="bar-general-energy">${u.energy}</span>
                        <span class="bar-general-info" data-unit-id="${u.id}">i</span>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.bar-general-info').forEach(el => {
                el.onclick = (e) => {
                    e.stopPropagation();
                    const unitId = e.currentTarget.dataset.unitId;
                    const unit = this.state.units.find(u => u.id == unitId);
                    if (unit) this.showDetail(unit);
                };
            });

            container.querySelectorAll('.bar-general').forEach(el => {
                el.onclick = (e) => {
                    const unitId = e.currentTarget.dataset.unitId;
                    const unit = this.state.units.find(u => u.id == unitId);
                    if (unit && !unit.dead && unit.player === this.state.currentPlayer) {
                        this.state.selectedUnit = unit;
                        this.state.currentSkill = null;
                        this.state.skillPhase = null;
                        this.state.skillTarget = null;
                        this.showMoves(unit);
                        this.renderBattle();
                    }
                };
            });
        };

        renderBar(1, p1Bar);
        renderBar(2, p2Bar);
    },

    showDetail(unit) {
        const panel = document.getElementById('detail-panel');
        if (!panel) return;
        document.getElementById('detail-name').textContent = unit.name;
        const moveRangeStr = Array.isArray(unit.moveRange) ? unit.moveRange.join(', ') : unit.moveRange;
        const attackRangeStr = Array.isArray(unit.attackRange) ? unit.attackRange.join(', ') : unit.attackRange;
        let debuffHtml = '';
        if (unit.debuffs && unit.debuffs.length > 0) debuffHtml = '<br>状态: ' + unit.debuffs.map(d => {
            if (d.type === 'poison') return '中毒(' + d.turns + '回合)';
            if (d.type === 'stun') return '眩晕(' + d.turns + '回合)';
            if (d.type === 'slow') return '减速(' + d.turns + '回合)';
            if (d.type === 'burn') return '燃烧(' + d.turns + '回合)';
            if (d.type === 'silence') return '沉默(' + d.turns + '回合)';
            if (d.type === 'shredDef') return '破甲(' + d.turns + '回合)';
            return d.type;
        }).join(', ');
        if (unit.stunned) debuffHtml += '<br>眩晕中，无法行动';
        if (unit.counterRate) debuffHtml += '<br>反击率: ' + Math.floor(unit.counterRate * 100) + '%';

        document.getElementById('detail-stats').innerHTML =
            'HP: ' + unit.hp + '/' + unit.maxHp + ' | 能量: ' + unit.energy + '<br>' +
            '攻击: ' + unit.atk + ' | 防御: ' + unit.def + ' | 移动: ' + unit.mov + '<br>' +
            '移动范围: ' + moveRangeStr + '<br>' +
            '攻击范围: ' + attackRangeStr + debuffHtml;

        const skills = unit.skills || [];
        document.getElementById('detail-skills').innerHTML = skills.map(s =>
            `<div class="skill-item"><div class="skill-name">${s.name} ${s.type === 'passive' ? '(被动)' : ''} - ${s.energyCost ? '能量:' + s.energyCost : ''}</div><div class="skill-desc">${s.desc}</div></div>`
        ).join('') || '<div>无技能</div>';

        panel.classList.remove('hidden');
    },

    hideDetail() {
        const panel = document.getElementById('detail-panel');
        if (panel) panel.classList.add('hidden');
    },

    // ========================================
    // 特效
    // ========================================
    showFloatingText(x, y, text, type) {
        const cell = document.querySelector('#battle-board .cell[data-x="' + x + '"][data-y="' + y + '"]');
        if (!cell) return;
        const el = document.createElement('div');
        el.className = 'float-text ' + type;
        el.textContent = text;
        cell.appendChild(el);
        setTimeout(() => el.remove(), 800);
    },

    addLungeAnimation(attacker, target) {
        const cell = document.querySelector('#battle-board .cell[data-x="' + attacker.x + '"][data-y="' + attacker.y + '"]');
        if (!cell) return;
        const unitEl = cell.querySelector('.unit');
        if (!unitEl) return;
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
        unitEl.classList.add('lunge-' + dir);
        setTimeout(() => unitEl.classList.remove('lunge-' + dir), 200);
    },

    addHitAnimation(target) {
        const cell = document.querySelector('#battle-board .cell[data-x="' + target.x + '"][data-y="' + target.y + '"]');
        if (!cell) return;
        const unitEl = cell.querySelector('.unit');
        if (!unitEl) return;
        unitEl.classList.add('hit');
        setTimeout(() => unitEl.classList.remove('hit'), 300);
    },

    addDeathAnimation(unit) {
        const cell = document.querySelector('#battle-board .cell[data-x="' + unit.x + '"][data-y="' + unit.y + '"]');
        if (!cell) return;
        const unitEl = cell.querySelector('.unit');
        if (!unitEl) return;
        unitEl.classList.add('dying');
    },

    renderUnit(unit) {
        const hpPercent = (unit.hp / unit.maxHp * 100).toFixed(0);
        const isSelected = this.state.selectedUnit && this.state.selectedUnit.id === unit.id;
        const statusTags = this.getStatusTags(unit);
        return `
            <div class="unit p${unit.player} ${isSelected ? 'selected' : ''}">
                <div class="unit-status-bar">${statusTags}</div>
                <div class="unit-icon">${unit.name}</div>
                <div class="unit-hp"><div class="unit-hp-fill" style="width:${hpPercent}%"></div></div>
            </div>
        `;
    },

    getStatusTags(unit) {
        const tags = [];
        if (unit.debuffs) {
            unit.debuffs.forEach(d => {
                if (d.type === 'poison') tags.push({ cls: 'status-poison', text: '毒' });
                if (d.type === 'stun') tags.push({ cls: 'status-stun', text: '晕' });
                if (d.type === 'slow') tags.push({ cls: 'status-slow', text: '缓' });
                if (d.type === 'burn') tags.push({ cls: 'status-burn', text: '燃' });
                if (d.type === 'silence') tags.push({ cls: 'status-silence', text: '默' });
                if (d.type === 'shredDef') tags.push({ cls: 'status-shred', text: '破' });
            });
        }
        if (unit._weiLinDebuffed) tags.push({ cls: 'status-weilin', text: '威' });
        return tags.map(t => `<span class="unit-status ${t.cls}">${t.text}</span>`).join('');
    },

    // ========================================
    // 战斗点击处理
    // ========================================
    handleBattleClick(x, y) {
        const unit = this.getUnit(x, y);
        const hlMove = this.state.highlights.find(h => h.x === x && h.y === y && h.type === 'move');
        const hlAttack = this.state.highlights.find(h => h.x === x && h.y === y && h.type === 'attack');
        const hlSkill = this.state.highlights.find(h => h.x === x && h.y === y && h.type === 'skill');

        // 多步技能 - 第二步选择落点
        if (this.state.skillPhase === 'step2' && this.state.currentSkill && this.state.skillTarget) {
            this.executeStep2Skill(x, y);
            return;
        }

        // 移动
        if (hlMove && this.state.selectedUnit) {
            this.executeMove(this.state.selectedUnit, x, y);
            return;
        }

        // 普通攻击
        if (hlAttack && this.state.selectedUnit && unit && unit.player !== this.state.selectedUnit.player) {
            this.executeNormalAttack(this.state.selectedUnit, unit);
            return;
        }

        // 技能执行
        if (hlSkill && this.state.selectedUnit && this.state.currentSkill) {
            this.executeStep1Skill(x, y, unit);
            return;
        }

        // 选择己方单位
        if (unit && unit.player === this.state.currentPlayer) {
            if (unit.stunned) { this.state.logs.push(unit.name + ' 处于眩晕状态，无法行动'); return; }
            this.state.selectedUnit = unit;
            this.cancelSkill();
            this.showMoves(unit);
            this.renderBattle();
            return;
        }

        // 点击空白处取消
        this.state.selectedUnit = null;
        this.cancelSkill();
        this.renderBattle();
    },

    // 移动
    executeMove(mover, x, y) {
        mover.x = x; mover.y = y; mover.moved = true;
        this.triggerSkillCharge(mover, 'afterMove');
        this.triggerSkillCharge(mover, 'afterAction');
        if (mover._passive_tianTi) {
            if (!mover.buffs) mover.buffs = [];
            mover.buffs.push({ stat: 'atk', value: 5, turns: 1 });
            mover.atk += 5;
        }
        this.clearHighlights();
        this.state.logs.push(mover.name + ' 移动');
        this.renderBattle();
    },

    // 普通攻击
    executeNormalAttack(attacker, target) {
        const result = window.Effect.damage(attacker, target, attacker.atk);
        this.addLungeAnimation(attacker, target);
        let extraActionGranted = false;

        this.addHitAnimation(target);
        this.showFloatingText(target.x, target.y, '-' + result.damage, 'damage');
        if (target.dead) {
            this.state.logs.push(attacker.name + ' 击杀 ' + target.name);
            this.addDeathAnimation(target);
            if (attacker._passive_changSheng) extraActionGranted = true;
        } else {
            this.state.logs.push(attacker.name + ' 攻击 ' + target.name + ' -' + result.damage);
        }
        if (result.counter) {
            this.state.logs.push(target.name + ' 反击 -' + result.counter);
            this.showFloatingText(attacker.x, attacker.y, '反击-' + result.counter, 'counter');
            this.addHitAnimation(attacker);
        }

        if (extraActionGranted) {
            window.Effect.grantExtraAction(attacker);
            this.state.logs.push(attacker.name + ' 常胜！获得额外行动');
            this.showFloatingText(attacker.x, attacker.y, '常胜！', 'heal');
        } else {
            attacker.attacked = true;
            this.triggerSkillCharge(attacker, 'afterAttack');
            this.triggerSkillCharge(attacker, 'afterAction');
        }
        this.clearHighlights();
        this.checkWin();
        this.renderBattle();
    },

    // 多步技能第一步
    executeStep1Skill(x, y, unit) {
        const skill = this.state.currentSkill;
        const attacker = this.state.selectedUnit;

        if (skill.step1 === 'selectEnemy' && this.state.skillPhase !== 'step2') {
            if (unit && unit.player !== attacker.player) {
                this.state.skillTarget = unit;
                this.state.skillPhase = 'step2';
                this.state.highlights = [];
                const landingRange = window.Range.parse(skill.step2Range || 'r2', unit.x, unit.y, null, window.TERRAIN);
                landingRange.forEach(p => {
                    if (!this.getUnit(p.x, p.y)) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
                });
                this.state.logs.push(attacker.name + ' 选择落点...');
                this.renderBattle();
            }
            return;
        }

        // 消耗能量
        if (skill.energyCost !== undefined) attacker.energy -= skill.energyCost;

        // 执行效果
        this.runActiveSkill(skill, attacker, unit, x, y);
    },

    // 多步技能第二步
    executeStep2Skill(x, y) {
        const skill = this.state.currentSkill;
        const attacker = this.state.selectedUnit;
        const target = this.state.skillTarget;
        if (!target || target.dead || !attacker) { this.cancelSkill(); return; }

        // 验证落点
        const landingRange = window.Range.parse(skill.step2Range || 'r2', target.x, target.y, null, window.TERRAIN);
        const valid = landingRange.find(p => p.x === x && p.y === y);
        if (!valid || this.getUnit(x, y)) { this.state.logs.push('无效的落点'); return; }

        if (skill.energyCost !== undefined) attacker.energy -= skill.energyCost;

        // 执行特殊技能：突进+伤害
        this.runActiveSkill(skill, attacker, target, x, y);
    },

    // 统一的主动技能执行入口
    runActiveSkill(skill, attacker, target, landingX, landingY) {
        const result = this.applyActiveSkill(skill, attacker, target, landingX, landingY);
        this.handleSkillResult(skill, attacker, target, result);
    },

    // 硬编码的技能效果（便于维护和扩展）
    applyActiveSkill(skill, attacker, target, landingX, landingY) {
        const id = skill.id;

        // 赵云 - 胆勇：突进 + 30伤害
        if (id === 'danYong') {
            if (landingX !== undefined && landingY !== undefined) {
                attacker.x = landingX; attacker.y = landingY;
            }
            const r = window.Effect.damage(attacker, target, 30);
            this.addHitAnimation(target);
            this.showFloatingText(target.x, target.y, '-' + r.damage, 'damage');
            return r;
        }

        // 关羽 - 水淹：30伤害 + 减速，河流地形翻倍
        if (id === 'shuiYan') {
            const bonus = window.TERRAIN[target.y][target.x] === 2 ? 2 : 1;
            const r = window.Effect.damage(attacker, target, 30 * bonus);
            window.Effect.slow(target, 1, 2);
            this.addHitAnimation(target);
            this.showFloatingText(target.x, target.y, '-' + r.damage + (bonus > 1 ? '(河流×2)' : ''), 'damage');
            return r;
        }

        // 张飞 - 乱舞：r1范围40伤害
        if (id === 'luanWu') {
            const targets = this.state.units.filter(u =>
                !u.dead && u.player !== attacker.player &&
                Math.abs(u.x - target.x) + Math.abs(u.y - target.y) <= 1);
            const details = [];
            let total = 0;
            targets.forEach(enemy => {
                const r = window.Effect.damage(attacker, enemy, 40);
                total += r.damage;
                this.addHitAnimation(enemy);
                this.showFloatingText(enemy.x, enemy.y, '-' + r.damage, 'damage');
                if (enemy.dead) this.addDeathAnimation(enemy);
                details.push({ name: enemy.name, damage: r.damage });
            });
            return { type: 'aoe', damage: total, targets: details };
        }

        // 诸葛亮 - 火箭：50伤害，燃烧目标翻倍
        if (id === 'huoJian') {
            const burnFlag = target.debuffs && target.debuffs.find(d => d.type === 'burn');
            const dmg = burnFlag ? 100 : 50;
            const r = window.Effect.damage(attacker, target, dmg);
            this.addHitAnimation(target);
            this.showFloatingText(target.x, target.y, '-' + r.damage, 'damage');
            return r;
        }

        // 诸葛亮 - 极速：友方立即获得再行动机会
        if (id === 'jiSu') {
            if (target && target.player === attacker.player) {
                window.Effect.grantExtraAction(target);
                this.showFloatingText(target.x, target.y, '极速！', 'heal');
                this.state.logs.push(target.name + ' 获得额外行动机会');
                return { type: 'buff' };
            }
            return null;
        }

        // 曹操 - 裹和：十字2格范围内25伤害+减速
        if (id === 'guoHe') {
            const targets = this.state.units.filter(u =>
                !u.dead && u.player !== attacker.player &&
                Math.abs(u.x - target.x) + Math.abs(u.y - target.y) <= 2);
            const details = [];
            let total = 0;
            targets.forEach(enemy => {
                const r = window.Effect.damage(attacker, enemy, 25);
                window.Effect.slow(enemy, 1, 2);
                total += r.damage;
                this.addHitAnimation(enemy);
                this.showFloatingText(enemy.x, enemy.y, '-' + r.damage, 'damage');
                if (enemy.dead) this.addDeathAnimation(enemy);
                details.push({ name: enemy.name, damage: r.damage });
            });
            return { type: 'aoe', damage: total, targets: details };
        }

        // 孙权 - 济武：召唤士兵
        if (id === 'jiWu') {
            const result = window.Effect.summon(attacker, landingX !== undefined ? landingX : target.x, landingY !== undefined ? landingY : target.y, 'soldier', this.state);
            return result;
        }

        // 黄忠 - 剧射：直线穿透35伤害
        if (id === 'juShe') {
            const dx = Math.sign(target.x - attacker.x) || 1;
            const dy = Math.sign(target.y - attacker.y) || 0;
            const details = [];
            let total = 0;
            for (let i = 1; i <= 12; i++) {
                const tx = attacker.x + dx * i;
                const ty = attacker.y + dy * i;
                if (tx < 0 || tx >= window.BOARD_SIZE || ty < 0 || ty >= window.BOARD_SIZE) break;
                const hit = this.state.units.find(u => u.x === tx && u.y === ty && !u.dead && u.player !== attacker.player);
                if (hit) {
                    const r = window.Effect.damage(attacker, hit, 35);
                    total += r.damage;
                    this.addHitAnimation(hit);
                    this.showFloatingText(hit.x, hit.y, '-' + r.damage, 'damage');
                    if (hit.dead) this.addDeathAnimation(hit);
                    details.push({ name: hit.name, damage: r.damage });
                }
            }
            return { type: 'pierce', damage: total, targets: details };
        }

        // 魏延 - 战栗：50伤害 + 眩晕
        if (id === 'zhanLi') {
            const r = window.Effect.damage(attacker, target, 50);
            window.Effect.stun(target, 1);
            this.addHitAnimation(target);
            this.showFloatingText(target.x, target.y, '-' + r.damage + '眩晕!', 'damage');
            return r;
        }

        // 马超 - 冲锋：突进+AOE
        if (id === 'chongZhen') {
            if (landingX !== undefined && landingY !== undefined) {
                attacker.x = landingX; attacker.y = landingY;
            }
            const targets = this.state.units.filter(u =>
                !u.dead && u.player !== attacker.player &&
                Math.abs(u.x - attacker.x) + Math.abs(u.y - attacker.y) <= 2);
            const details = [];
            let total = 0;
            targets.forEach(enemy => {
                const r = window.Effect.damage(attacker, enemy, 30);
                total += r.damage;
                this.addHitAnimation(enemy);
                this.showFloatingText(enemy.x, enemy.y, '-' + r.damage, 'damage');
                if (enemy.dead) this.addDeathAnimation(enemy);
                details.push({ name: enemy.name, damage: r.damage });
            });
            return { type: 'aoe', damage: total, targets: details };
        }

        // 吕布 - 方天画戟：80伤害
        if (id === 'fangTian') {
            const r = window.Effect.damage(attacker, target, 80);
            this.addHitAnimation(target);
            this.showFloatingText(target.x, target.y, '-' + r.damage, 'damage');
            if (target.dead) this.addDeathAnimation(target);
            return r;
        }

        // 调试武将 - 测试打击
        if (id && id.startsWith('testDmg')) {
            const r = window.Effect.damage(attacker, target, 10);
            this.addHitAnimation(target);
            this.showFloatingText(target.x, target.y, '-' + r.damage, 'damage');
            return r;
        }

        // 默认：尝试造成伤害
        if (target && target.player !== attacker.player) {
            const r = window.Effect.damage(attacker, target, 10);
            this.addHitAnimation(target);
            this.showFloatingText(target.x, target.y, '-' + r.damage, 'damage');
            return r;
        }
        return null;
    },

    // 技能结果处理
    handleSkillResult(skill, attacker, target, result) {
        if (!result) { this.cancelSkill(); this.checkWin(); this.renderBattle(); return; }

        let extraActionGranted = false;

        if (result.type === 'aoe' || result.type === 'pierce') {
            this.state.logs.push(attacker.name + ' ' + skill.name);
            if (result.targets) result.targets.forEach(t => this.state.logs.push('  ' + t.name + ' -' + t.damage));
        } else if (result.damage !== undefined && result.damage !== null) {
            if (target && target.dead) {
                this.state.logs.push(attacker.name + ' 击杀 ' + target.name);
                if (attacker._passive_changSheng) extraActionGranted = true;
            } else if (target) {
                this.state.logs.push(attacker.name + ' ' + skill.name + ' ' + target.name + ' -' + result.damage);
            }
        } else if (result.type === 'summon') {
            this.state.logs.push(attacker.name + ' 召唤 ' + result.unit.name);
        } else if (result.type === 'buff') {
            // 已在 applyActiveSkill 中处理
        }

        if (extraActionGranted) {
            window.Effect.grantExtraAction(attacker);
            this.state.logs.push(attacker.name + ' 常胜！获得额外行动');
            this.showFloatingText(attacker.x, attacker.y, '常胜！', 'heal');
        } else {
            attacker.usedSkill = true;
            this.triggerSkillCharge(attacker, 'afterAction');
        }

        this.cancelSkill();
        this.checkWin();
        this.renderBattle();
    },

    selectSkill(skill) {
        if (!this.state.selectedUnit) return;
        this.state.currentSkill = skill;
        this.state.highlights = [];
        const u = this.state.selectedUnit;

        // 多步技能：第一步选择目标敌人
        if (skill.step1 === 'selectEnemy') {
            this.state.skillPhase = 'step1';
            const range = window.Range.parse(skill.step1Range || skill.range, u.x, u.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
            range.forEach(p => {
                const target = this.getUnit(p.x, p.y);
                if (target && target.player !== u.player) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            });
            this.state.logs.push(u.name + ' 选择' + skill.name + '目标...');
            this.renderBattle();
            return;
        }

        // 普通单步技能
        this.state.skillPhase = null;
        const range = window.Range.parse(skill.range, u.x, u.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
        if (skill.category === 'summon') {
            range.forEach(p => { if (!this.getUnit(p.x, p.y)) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' }); });
        } else if (skill.category === 'buff') {
            range.forEach(p => {
                const target = this.getUnit(p.x, p.y);
                if (target && target.player === u.player) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            });
        } else {
            range.forEach(p => {
                const target = this.getUnit(p.x, p.y);
                if (target && target.player !== u.player) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            });
        }
        this.renderBattle();
    },

    cancelSkill() {
        this.state.currentSkill = null;
        this.state.skillPhase = null;
        this.state.skillTarget = null;
        this.clearHighlights();
    },

    showMoves(unit) {
        this.state.highlights = [];
        const blockedSet = new Set();
        this.state.units.forEach(u => { if (!u.dead) blockedSet.add(u.x + ',' + u.y); });

        if (!unit.moved) {
            const moveRange = window.Range.parseBlocked(unit.moveRange || '+' + unit.mov, unit.x, unit.y, blockedSet, window.BLOCKING_TERRAIN_MOVE, window.TERRAIN);
            moveRange.forEach(p => { if (!this.getUnit(p.x, p.y)) this.state.highlights.push({ x: p.x, y: p.y, type: 'move' }); });
        }

        if (!unit.attacked) {
            const attackRange = window.Range.parseBlocked(unit.attackRange || '+1', unit.x, unit.y, blockedSet, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
            attackRange.forEach(p => {
                const target = this.getUnit(p.x, p.y);
                if (target && target.player !== unit.player) this.state.highlights.push({ x: p.x, y: p.y, type: 'attack' });
                else if (!target) this.state.highlights.push({ x: p.x, y: p.y, type: 'attack-range' });
            });
        }
    },

    clearHighlights() { this.state.highlights = []; },

    // ========================================
    // 回合结束
    // ========================================
    endTurn() {
        this.state.units.forEach(u => {
            u.moved = false; u.attacked = false; u.usedSkill = false;
            if (!u.dead) {
                if (u._passive_guanChuan) {
                    this.state.units.forEach(ally => {
                        if (!ally.dead && ally.player === u.player && ally.hp < ally.maxHp) {
                            ally.hp = Math.min(ally.maxHp, ally.hp + 10);
                            this.state.logs.push(ally.name + ' 观星恢复 +10');
                        }
                    });
                }
                this.triggerSkillCharge(u, 'onTurn');
            }
            if (u.buffs) {
                const newBuffs = [];
                u.buffs.forEach(b => {
                    b.turns--;
                    if (b.turns > 0) newBuffs.push(b);
                    else if (b.stat === 'atk' || b.stat === 'def') u[b.stat] -= b.value;
                });
                u.buffs = newBuffs;
            }
            if (u.debuffs) {
                const newDebuffs = [];
                u.debuffs.forEach(d => {
                    d.turns--;
                    if (!u.dead) {
                        if (d.type === 'poison') { u.hp = Math.max(1, u.hp - d.damage); this.state.logs.push(u.name + ' 中毒 -' + d.damage); }
                        if (d.type === 'burn') { u.hp = Math.max(1, u.hp - d.damage); this.state.logs.push(u.name + ' 燃烧 -' + d.damage); }
                    }
                    if (d.turns > 0) newDebuffs.push(d);
                    else {
                        if (d.type === 'slow') u.mov = d.originalMov || u.mov;
                        if (d.type === 'shredDef') u.def = d.originalDef || u.def;
                    }
                });
                u.debuffs = newDebuffs;
            }
            if (u.stunned && u.stunned > 0) { u.stunned--; if (u.stunned <= 0) { u.stunned = 0; this.state.logs.push(u.name + ' 眩晕解除'); } }
            if (u.silenced && u.silenced > 0) { u.silenced--; if (u.silenced <= 0) { u.silenced = 0; this.state.logs.push(u.name + ' 沉默解除'); } }
        });

        // 关羽【威临】光环
        this.state.units.forEach(u => {
            if (u._passive_weiLin && !u.dead) {
                const auraRange2 = window.Range.parse('+2', u.x, u.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
                const auraRange1 = window.Range.parse('+1', u.x, u.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
                this.state.units.forEach(enemy => {
                    if (enemy.dead || enemy.player === u.player) return;
                    const inRange2 = auraRange2.find(p => p.x === enemy.x && p.y === enemy.y);
                    if (inRange2 && !enemy._weiLinDebuffed) { enemy.atk = Math.max(1, enemy.atk - 10); enemy._weiLinDebuffed = true; }
                    else if (!inRange2 && enemy._weiLinDebuffed) { enemy.atk += 10; enemy._weiLinDebuffed = false; }
                    const inRange1 = auraRange1.find(p => p.x === enemy.x && p.y === enemy.y);
                    if (inRange1 && !enemy.silenced) window.Effect.silence(enemy, 1);
                });
            }
        });

        this.state.selectedUnit = null;
        this.cancelSkill();

        if (this.state.currentPlayer === 2) {
            this.state.turn++;
            this.state.currentPlayer = 1;
            this.state.logs.push('第' + this.state.turn + '回合 红方');
        } else {
            this.state.currentPlayer = 2;
            this.state.logs.push('蓝方回合');
        }

        if (this.state.mode === 'pve' && this.state.currentPlayer === 2) {
            setTimeout(() => this.aiTurn(), 1200);
        } else {
            this.renderBattle();
        }
    },

    aiTurn() {
        const aiUnits = this.state.units.filter(u => u.player === 2 && !u.dead);
        aiUnits.forEach(unit => {
            const enemies = this.state.units.filter(e => e.player === 1 && !e.dead);
            if (enemies.length === 0) return;
            let target = enemies[0];
            let minDist = 999;
            enemies.forEach(e => {
                const dist = Math.abs(e.x - unit.x) + Math.abs(e.y - unit.y);
                if (dist < minDist) { minDist = dist; target = e; }
            });
            if (!unit.moved && minDist > 1) {
                const dx = Math.sign(target.x - unit.x);
                const dy = Math.sign(target.y - unit.y);
                const nx = unit.x + (dx !== 0 ? dx : 0);
                const ny = unit.y + (dy !== 0 ? dy : 0);
                if (nx >= 0 && nx < window.BOARD_SIZE && ny >= 0 && ny < window.BOARD_SIZE && !this.getUnit(nx, ny)) {
                    unit.x = nx; unit.y = ny; unit.moved = true;
                }
            }
            const newDist = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);
            if (newDist <= 1 && !unit.attacked) {
                const damage = Math.max(1, Math.floor(unit.atk - target.def * 0.3));
                target.hp -= damage;
                if (target.hp <= 0) { target.dead = true; target.hp = 0; }
                unit.attacked = true;
            }
        });
        this.checkWin();
        setTimeout(() => {
            this.state.units.forEach(u => { u.moved = false; u.attacked = false; u.usedSkill = false; });
            this.state.turn++;
            this.state.currentPlayer = 1;
            this.state.logs.push('第' + this.state.turn + '回合 红方');
            this.renderBattle();
        }, 300);
    },

    triggerSkillCharge(unit, triggerType) {
        if (unit.dead) return;
        const skills = unit.skills || [];
        let charged = false;
        skills.forEach(s => { if (s.chargeTrigger === triggerType) { unit.energy += 1; charged = true; } });
        if (charged) this.showFloatingText(unit.x, unit.y, '+1能量', 'heal');
    },

    checkWin() {
        const p1Alive = this.state.units.filter(u => u.player === 1 && !u.dead && u.generalId).length;
        const p2Alive = this.state.units.filter(u => u.player === 2 && !u.dead && u.generalId).length;
        if (p1Alive === 0) this.endGame(2);
        else if (p2Alive === 0) this.endGame(1);
    },

    endGame(winner) {
        document.getElementById('winner-text').textContent = (winner === 1 ? '红方' : '蓝方') + ' 胜利！';
        this.showScreen('gameover');
    },

    resetGame() {
        this.state = {
            mode: 'pvp',
            currentPlayer: 1, turn: 1,
            selectedUnit: null, currentSkill: null,
            skillPhase: null, skillTarget: null,
            highlights: [], logs: [], units: [],
            players: {
                1: { generals: [], deployed: [], toDeploy: null },
                2: { generals: [], deployed: [], toDeploy: null }
            }
        };
        this.showScreen('menu');
    },

    getUnit(x, y) {
        return this.state.units.find(u => u.x === x && u.y === y && !u.dead);
    }
};

window.Game = Game;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DOM] DOMContentLoaded fired');
    Game.init();
});
