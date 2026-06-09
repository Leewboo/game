// ================================
// 游戏逻辑 - 软编码技能系统
// ================================
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
        this.state._modules = { Range: window.Range, Effect: window.Effect };
        this.bindEvents();
        this.showScreen('menu');
        console.log('[Game] init done');
    },

    getEffect() {
        return window.Effect && typeof window.Effect === 'object' ? window.Effect : null;
    },

    safeEffectCall(methodName, ...args) {
        const effect = this.getEffect();
        if (effect && typeof effect[methodName] === 'function') {
            return effect[methodName](...args);
        }
        console.warn(`[Game] Effect.${methodName} not available, skipping`);
        return null;
    },

    showScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.remove('active'));
        const targetScreen = document.getElementById(`${screenId}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    },

    bindEvents() {
        const pvpBtn = document.getElementById('pvp-btn');
        const pveBtn = document.getElementById('pve-btn');
        const customBtn = document.getElementById('custom-btn');

        if (pvpBtn) {
            pvpBtn.addEventListener('click', () => {
                this.state.mode = 'pvp';
                this.startSelect();
            });
        }
        if (pveBtn) {
            pveBtn.addEventListener('click', () => {
                this.state.mode = 'pve';
                this.startSelect();
            });
        }
        if (customBtn) customBtn.addEventListener('click', () => alert('DIY武将功能即将开放！'));

        const confirmSelect = document.getElementById('confirm-select');
        const endTurn = document.getElementById('end-turn');
        const restartBtn = document.getElementById('restart-btn');
        const closeDetail = document.getElementById('close-detail');
        const detailPanel = document.getElementById('detail-panel');

        if (confirmSelect) confirmSelect.addEventListener('click', () => this.confirmSelect());
        if (endTurn) endTurn.addEventListener('click', () => this.endTurn());
        if (restartBtn) restartBtn.addEventListener('click', () => this.resetGame());
        if (closeDetail) closeDetail.addEventListener('click', () => this.hideDetail());
        if (detailPanel) {
            detailPanel.addEventListener('click', (e) => {
                if (e.target.id === 'detail-panel') this.hideDetail();
            });
        }

        const wSlider = document.getElementById('cell-width');
        const hSlider = document.getElementById('cell-height');
        if (wSlider) {
            wSlider.oninput = (e) => {
                const val = e.target.value;
                document.getElementById('cell-width-val').textContent = val;
                document.documentElement.style.setProperty('--cell-w', val + 'px');
            };
        }
        if (hSlider) {
            hSlider.oninput = (e) => {
                const val = e.target.value;
                document.getElementById('cell-height-val').textContent = val;
                document.documentElement.style.setProperty('--cell-h', val + 'px');
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

        title.textContent = `${this.state.currentPlayer === 1 ? '红方' : '蓝方'} 选将`;
        const selected = this.state.players[this.state.currentPlayer].generals;
        count.textContent = `${selected.length}/5`;
        confirm.disabled = selected.length < 5;

        list.innerHTML = window.GENERALS.map(g => {
            const isSelected = selected.find(s => s.id === g.id);
            const isOpponentSelected = this.state.players[this.state.currentPlayer === 1 ? 2 : 1].generals.find(s => s.id === g.id);
            return `
                <div class="general-card ${isSelected ? 'selected' : ''}" data-id="${g.id}" style="opacity: ${isOpponentSelected ? '0.2' : '1'}">
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
                    const moveRangeStr = Array.isArray(g.moveRange) ? g.moveRange.join(', ') : g.moveRange;
                    const attackRangeStr = Array.isArray(g.attackRange) ? g.attackRange.join(', ') : g.attackRange;
                    const skillsDesc = g.skills.map(s =>
                        `${s.name}(${s.type === 'passive' ? '被动' : '主动'}${s.energyCost ? ` 能量:${s.energyCost}` : ''}): ${s.desc}`
                    ).join('\n');
                    alert(`${g.name}\nHP: ${g.hp} | 攻: ${g.atk} | 防: ${g.def} | 移: ${g.mov}\n移动范围: ${moveRangeStr}\n攻击范围: ${attackRangeStr}\n\n技能:\n${skillsDesc}`);
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

        title.textContent = `${player === 1 ? '红方' : '蓝方'} 布阵`;
        count.textContent = `${deployed.length}/5`;

        board.innerHTML = '';
        for (let y = 0; y < window.BOARD_SIZE; y++) {
            for (let x = 0; x < window.BOARD_SIZE; x++) {
                const terrainId = window.TERRAIN[y][x];
                const terrain = window.TERRAIN_NAMES[terrainId];
                const terrainLabel = window.TERRAIN_LABELS[terrainId];
                const unit = this.getUnit(x, y);

                let cellClass = `cell ${terrain}`;
                if (player === 1 && y >= window.BOARD_SIZE - 3) cellClass += ' deploy-zone-p1';
                if (player === 2 && y <= 2) cellClass += ' deploy-zone-p2';

                const cell = document.createElement('div');
                cell.className = cellClass;
                cell.dataset.x = x;
                cell.dataset.y = y;

                let cellHtml = '';
                if (x === 0) cellHtml += `<span class="cell-label top-left">${y}</span>`;
                if (y === BOARD_SIZE - 1) cellHtml += `<span class="cell-label bottom-left">${x}</span>`;
                if (terrainLabel) cellHtml += `<span class="terrain-label" style="font-size:24px;opacity:0.7">${terrainLabel}</span>`;
                if (unit) cellHtml += this.renderUnit(unit);
                cell.innerHTML = cellHtml;

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
        if (player === 1 && y < BOARD_SIZE - 3) return;
        if (player === 2 && y > 2) return;
        if (this.getUnit(x, y)) return;

        const generals = this.state.players[player].generals;
        const deployed = this.state.players[player].deployed;

        let generalIdx = this.state.players[player].toDeploy;
        if (generalIdx === null) {
            for (let i = 0; i < 5; i++) {
                if (!deployed.find(d => d.generalId === generals[i].id)) {
                    generalIdx = i;
                    break;
                }
            }
        }
        if (generalIdx === null || generalIdx === -1) return;
        if (deployed.find(d => d.generalId === generals[generalIdx].id)) return;

        const general = generals[generalIdx];
        const unit = this.createUnitFromGeneral(general, player, x, y);

        this.state.units.push(unit);
        deployed.push({ generalId: general.id, unitId: unit.id });
        this.state.players[player].toDeploy = null;

        if (deployed.length === 5) {
            if (player === 1) {
                this.state.currentPlayer = 2;
                if (this.state.mode === 'pve') {
                    this.deployAI();
                } else {
                    this.renderDeploy();
                }
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
        this.state.players[2].generals.forEach((g, i) => {
            const posIdx = Math.floor(Math.random() * available.length);
            const pos = available[posIdx];
            available.splice(posIdx, 1);
            const unit = this.createUnitFromGeneral(g, 2, pos.x, pos.y);
            this.state.units.push(unit);
            this.state.players[2].deployed.push({ generalId: g.id, unitId: unit.id });
        });
        this.startBattle();
    },

    // ========================================
    // 战斗阶段
    // ========================================
    startBattle() {
        // 将地形数据和模块引用复制到 state，供 effect.js 使用
        this.state.TERRAIN = window.TERRAIN;
        this.state.BOARD_SIZE = window.BOARD_SIZE;
        this.state.Effect = window.Effect;
        this.state.Range = window.Range;

        // 初始化所有单位的被动技能效果
        this.state.units.forEach(u => {
            this.initPassiveSkills(u);
        });

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

    // 初始化被动技能效果
    initPassiveSkills(unit) {
        if (!unit.skills) return;
        
        const passiveSkills = unit.skills.filter(s => s.type === 'passive');
        passiveSkills.forEach(skill => {
            if (skill.effects) {
                skill.effects.forEach(effect => {
                    if (window.Effect && typeof window.Effect.executeEffect === 'function') {
                        window.Effect.executeEffect(effect, unit, unit, this.state);
                    } else {
                        this.applyPassiveEffectFallback(unit, effect);
                    }
                });
            }
        });
    },

    applyPassiveEffectFallback(unit, effect) {
        if (!effect) return;
        
        const { type, flag, value, stat, modify } = effect;
        
        if (type === 'passive') {
            if (flag) {
                unit[flag] = value;
            }
            
            if (stat && modify) {
                if (stat === 'attackRange' && typeof modify === 'string' && modify.startsWith('+')) {
                    const add = parseInt(modify.substring(1));
                    const current = unit.attackRange || '+1';
                    const match = current.match(/^([+xr])(\d+)$/);
                    if (match) {
                        const type = match[1];
                        const num = parseInt(match[2]) + add;
                        unit.attackRange = type + num;
                    }
                } else if (typeof modify === 'number') {
                    unit[stat] = (unit[stat] || 0) + modify;
                }
            }
        }
    },

    // 从武将数据创建战斗单位
    createUnitFromGeneral(general, player, x, y) {
        return {
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
    },

    renderBattle() {
        const info = document.getElementById('turn-info');
        const board = document.getElementById('battle-board');
        const log = document.getElementById('log-panel');

        if (info) info.textContent = `第${this.state.turn}回合 ${this.state.currentPlayer === 1 ? '红方' : '蓝方'}`;

        if (board) {
            board.innerHTML = '';
            for (let y = 0; y < window.BOARD_SIZE; y++) {
                for (let x = 0; x < window.BOARD_SIZE; x++) {
                    const terrainId = window.TERRAIN[y][x];
                    const terrain = window.TERRAIN_NAMES[terrainId];
                    const terrainLabel = window.TERRAIN_LABELS[terrainId];
                    const unit = this.getUnit(x, y);
                    const hl = this.state.highlights.find(h => h.x === x && h.y === y);

                    let cellClass = `cell ${terrain}`;
                    if (hl) cellClass += ` highlight-${hl.type}`;

                    const cell = document.createElement('div');
                    cell.className = cellClass;
                    cell.dataset.x = x;
                    cell.dataset.y = y;

                    let cellHtml = '';
                    if (x === 0) cellHtml += `<span class="cell-label top-left">${y}</span>`;
                    if (y === BOARD_SIZE - 1) cellHtml += `<span class="cell-label bottom-left">${x}</span>`;
                    if (terrainLabel) cellHtml += `<span class="terrain-label" style="font-size:24px;opacity:0.7">${terrainLabel}</span>`;
                    if (unit) cellHtml += this.renderUnit(unit);
                    cell.innerHTML = cellHtml;

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
        if (!u) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');
        const skills = u.skills || [];
        const activeSkills = skills.filter(s => s.type === 'active');
        const passiveSkills = skills.filter(s => s.type === 'passive');

        container.innerHTML = `
            <div class="sel-info-skills">
                ${activeSkills.map(s => {
                    const isCharged = s.energyCost !== undefined;
                    const canUse = (!isCharged || u.energy >= s.energyCost) && !u.usedSkill && !u.silenced;
                    const label = u.silenced ? `${s.name}(沉默)` : (isCharged ? `${s.name}(${s.energyCost}能量)` : s.name);
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
                if (u.silenced) {
                    this.state.logs.push(`${u.name} 处于沉默状态，无法使用技能`);
                    return;
                }
                if (skill && (!isCharged || u.energy >= skill.energyCost) && !u.usedSkill) {
                    this.selectSkill(skill);
                }
            };
        });

        container.querySelectorAll('.sel-skill-info').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                const sid = e.currentTarget.dataset.skill;
                const skill = u.skills.find(s => s.id === sid);
                if (skill) {
                    alert(`${skill.name}\n类型: ${skill.type === 'passive' ? '被动' : '主动'}\n范围: ${skill.range || '-'}\n能量: ${skill.energyCost || 0}\n${skill.desc}`);
                }
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
                        <div class="bar-general-hp">
                            <div class="bar-general-hp-fill" style="width: ${hpPercent}%"></div>
                        </div>
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
        const nameEl = document.getElementById('detail-name');
        const statsEl = document.getElementById('detail-stats');
        const skillsEl = document.getElementById('detail-skills');

        nameEl.textContent = unit.name;

        const moveRangeStr = Array.isArray(unit.moveRange) ? unit.moveRange.join(', ') : unit.moveRange;
        const attackRangeStr = Array.isArray(unit.attackRange) ? unit.attackRange.join(', ') : unit.attackRange;

        let debuffHtml = '';
        if (unit.debuffs && unit.debuffs.length > 0) {
            debuffHtml = '<br>状态: ' + unit.debuffs.map(d => {
                if (d.type === 'poison') return `中毒(${d.turns}回合)`;
                if (d.type === 'stun') return `眩晕(${d.turns}回合)`;
                if (d.type === 'slow') return `减速(${d.turns}回合)`;
                if (d.type === 'burn') return `燃烧(${d.turns}回合)`;
                if (d.type === 'confuse') return `混乱(${d.turns}回合)`;
                if (d.type === 'shredDef') return `破甲(${d.turns}回合)`;
                return d.type;
            }).join(', ');
        }
        if (unit.stunned) debuffHtml += '<br>眩晕中，无法行动';
        if (unit.counterRate) debuffHtml += `<br>反击率: ${Math.floor(unit.counterRate * 100)}%`;
        if (unit.dodgeRate) debuffHtml += `<br>闪避率: ${Math.floor(unit.dodgeRate * 100)}%`;

        statsEl.innerHTML = `
            HP: ${unit.hp}/${unit.maxHp} | 能量: ${unit.energy}<br>
            攻击: ${unit.atk} | 防御: ${unit.def} | 移动: ${unit.mov}<br>
            移动范围: ${moveRangeStr}<br>
            攻击范围: ${attackRangeStr}
            ${debuffHtml}
        `;

        const skills = unit.skills || [];
        skillsEl.innerHTML = skills.map(s => `
            <div class="skill-item">
                <div class="skill-name">${s.name} ${s.type === 'passive' ? '(被动)' : ''} - ${s.energyCost ? `能量:${s.energyCost}` : ''}</div>
                <div class="skill-desc">${s.desc}</div>
            </div>
        `).join('') || '<div>无技能</div>';

        panel.classList.remove('hidden');
    },

    hideDetail() {
        document.getElementById('detail-panel').classList.add('hidden');
    },

    // ========================================
    // 特效系统
    // ========================================
    showFloatingText(x, y, text, type) {
        const cell = document.querySelector(`#battle-board .cell[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        const el = document.createElement('div');
        el.className = `float-text ${type}`;
        el.textContent = text;
        cell.appendChild(el);
        setTimeout(() => el.remove(), 800);
    },

    addLungeAnimation(attacker, target) {
        const cell = document.querySelector(`#battle-board .cell[data-x="${attacker.x}"][data-y="${attacker.y}"]`);
        if (!cell) return;
        const unitEl = cell.querySelector('.unit');
        if (!unitEl) return;
        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
        unitEl.classList.add(`lunge-${dir}`);
        setTimeout(() => unitEl.classList.remove(`lunge-${dir}`), 200);
    },

    addHitAnimation(target) {
        const cell = document.querySelector(`#battle-board .cell[data-x="${target.x}"][data-y="${target.y}"]`);
        if (!cell) return;
        const unitEl = cell.querySelector('.unit');
        if (!unitEl) return;
        unitEl.classList.add('hit');
        setTimeout(() => unitEl.classList.remove('hit'), 300);
    },

    addDeathAnimation(unit) {
        const cell = document.querySelector(`#battle-board .cell[data-x="${unit.x}"][data-y="${unit.y}"]`);
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
                <div class="unit-hp">
                    <div class="unit-hp-fill" style="width: ${hpPercent}%"></div>
                </div>
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
                if (d.type === 'confuse') tags.push({ cls: 'status-confuse', text: '乱' });
                if (d.type === 'shredDef') tags.push({ cls: 'status-shred', text: '破' });
                if (d.type === 'silence') tags.push({ cls: 'status-silence', text: '默' });
            });
        }
        if (unit._weiLinDebuffed) tags.push({ cls: 'status-weilin', text: '威' });
        if (unit.buffs) {
            unit.buffs.forEach(b => {
                if (b.stat === 'atk') tags.push({ cls: 'status-buff-atk', text: '攻' });
                if (b.stat === 'def') tags.push({ cls: 'status-buff-def', text: '防' });
            });
        }
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

        // 多步技能 - 第二步：选择落点
        if (this.state.skillPhase === 'step2' && this.state.currentSkill && this.state.skillTarget) {
            const skill = this.state.currentSkill;
            const target = this.state.skillTarget;
            const attacker = this.state.selectedUnit;

            if (!target || target.dead || !attacker) {
                this.cancelSkill();
                return;
            }

            const landingRange = window.Range.parse(skill.step2Range || 'r2', target.x, target.y, null, window.TERRAIN);
            const valid = landingRange.find(p => p.x === x && p.y === y);
            if (!valid || this.getUnit(x, y)) {
                this.state.logs.push('无效的落点');
                return;
            }

            // 消耗能量
            if (skill.energyCost !== undefined) attacker.energy -= skill.energyCost;

            // 执行技能效果
            this.state._target = target;
            const result = this.safeEffectCall('executeEffects', skill.effects, attacker, target, this.state, { x, y });
            this.state._target = null;

            // 处理结果
            this.handleSkillResult(skill, attacker, target, result, { x, y });
            return;
        }

        // 移动
        if (hlMove && this.state.selectedUnit) {
            const mover = this.state.selectedUnit;
            mover.x = x;
            mover.y = y;
            mover.moved = true;

            // 触发充能
            this.triggerSkillCharge(mover, 'afterMove');
            this.triggerSkillCharge(mover, 'afterAction');

            // 被动效果：铁骑 - 每移动一次攻击力+5
            if (mover._passive_tianTi) {
                if (!mover.buffs) mover.buffs = [];
                mover.buffs.push({ stat: 'atk', value: 5, turns: 1 });
                mover.atk += 5;
            }

            this.clearHighlights();
            this.state.logs.push(`${mover.name} 移动`);
            this.renderBattle();
            return;
        }

        // 普通攻击
        if (hlAttack && this.state.selectedUnit && unit && unit.player !== this.state.selectedUnit.player) {
            const attacker = this.state.selectedUnit;
            const result = this.safeEffectCall('damage', attacker, unit, attacker.atk);
            this.addLungeAnimation(attacker, unit);
            let extraActionGranted = false;

            if (result && result.type === 'dodge') {
                this.state.logs.push(`${unit.name} 闪避了攻击！`);
                this.showFloatingText(unit.x, unit.y, '闪避', 'dodge');
            } else if (result) {
                this.addHitAnimation(unit);
                this.showFloatingText(unit.x, unit.y, `-${result.damage || 0}`, 'damage');
                if (unit.dead) {
                    this.state.logs.push(`${attacker.name} 击杀 ${unit.name}`);
                    this.addDeathAnimation(unit);
                    if (attacker._passive_changSheng) {
                        extraActionGranted = true;
                    }
                } else {
                    this.state.logs.push(`${attacker.name} 攻击 ${unit.name} -${result.damage || 0}`);
                }
            }

            if (result && result.counter) {
                this.state.logs.push(`${unit.name} 反击 -${result.counter}`);
                this.showFloatingText(attacker.x, attacker.y, `反击-${result.counter}`, 'counter');
                this.addHitAnimation(attacker);
            }

            if (extraActionGranted) {
                this.safeEffectCall('grantExtraAction', attacker);
                this.state.logs.push(`${attacker.name} 常胜！获得额外行动`);
                this.showFloatingText(attacker.x, attacker.y, '常胜！', 'heal');
            } else {
                attacker.attacked = true;
                this.triggerSkillCharge(attacker, 'afterAttack');
                this.triggerSkillCharge(attacker, 'afterAction');
            }

            this.clearHighlights();
            this.checkWin();
            this.renderBattle();
            return;
        }

        // 技能执行
        if (hlSkill && this.state.selectedUnit && this.state.currentSkill) {
            const skill = this.state.currentSkill;
            const attacker = this.state.selectedUnit;

            // 多步技能 - 第一步：选择目标敌人
            if (skill.step1 === 'selectEnemy' && this.state.skillPhase === 'step1') {
                if (unit && unit.player !== attacker.player) {
                    this.state.skillTarget = unit;
                    this.state.skillPhase = 'step2';
                    this.state.highlights = [];
                    const landingRange = window.Range.parse(skill.step2Range || 'r2', unit.x, unit.y, null, TERRAIN);
                    landingRange.forEach(p => {
                        if (!this.getUnit(p.x, p.y)) {
                            this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
                        }
                    });
                    this.state.logs.push(`${attacker.name} 选择落点...`);
                    this.renderBattle();
                }
                return;
            }

            // 消耗能量
            if (skill.energyCost !== undefined) attacker.energy -= skill.energyCost;

            // 执行技能效果
            this.state._target = unit;
            const result = this.safeEffectCall('executeEffects', skill.effects, attacker, unit, this.state);
            this.state._target = null;

            // 处理结果
            this.handleSkillResult(skill, attacker, unit, result);
            return;
        }

        // 选择己方单位
        if (unit && unit.player === this.state.currentPlayer) {
            if (unit.stunned) {
                this.state.logs.push(`${unit.name} 处于眩晕状态，无法行动`);
                return;
            }
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

    // 处理技能执行结果
    handleSkillResult(skill, attacker, target, result, extraData = {}) {
        if (!result) {
            this.cancelSkill();
            this.checkWin();
            this.renderBattle();
            return;
        }

        let extraActionGranted = false;

        // 显示结果
        if (result.type === 'aoe' || result.type === 'pierce' || result.type === 'cone') {
            this.state.logs.push(`${attacker.name} ${skill.name}`);
            if (result.targets) {
                result.targets.forEach(t => {
                    const tUnit = this.state.units.find(u => u.name === t.name && !u.dead);
                    if (tUnit) {
                        if (t.type === 'dodge') {
                            this.showFloatingText(tUnit.x, tUnit.y, '闪避', 'dodge');
                        } else {
                            this.showFloatingText(tUnit.x, tUnit.y, `-${t.damage}`, 'damage');
                            this.addHitAnimation(tUnit);
                            if (tUnit.dead) this.addDeathAnimation(tUnit);
                        }
                    }
                    if (t.type === 'dodge') {
                        this.state.logs.push(`  ${t.name} 闪避`);
                    } else {
                        this.state.logs.push(`  ${t.name} -${t.damage}`);
                    }
                });
            }
        } else if (result.type === 'damage' || result.type === 'combined') {
            if (target.dead) {
                this.state.logs.push(`${attacker.name} 击杀 ${target.name}`);
                this.addHitAnimation(target);
                this.showFloatingText(target.x, target.y, `-${result.damage || 0}`, 'damage');
                this.addDeathAnimation(target);
                if (attacker._passive_changSheng) {
                    extraActionGranted = true;
                }
            } else {
                this.addHitAnimation(target);
                this.showFloatingText(target.x, target.y, `-${result.damage || 0}`, 'damage');
                this.state.logs.push(`${attacker.name} ${skill.name} ${target.name} -${result.damage || 0}`);
            }
            if (result.counter) {
                this.state.logs.push(`${target.name} 反击 -${result.counter}`);
                this.showFloatingText(attacker.x, attacker.y, `反击-${result.counter}`, 'counter');
                this.addHitAnimation(attacker);
            }
        } else if (result.type === 'heal') {
            this.showFloatingText(attacker.x, attacker.y, `+${result.heal}`, 'heal');
            this.state.logs.push(`${attacker.name} ${skill.name} 治疗${result.heal}`);
        } else if (result.type === 'summon') {
            this.state.logs.push(`${attacker.name} ${skill.name} 召唤 ${result.unit.name}`);
        }

        if (extraActionGranted) {
            this.safeEffectCall('grantExtraAction', attacker);
            this.state.logs.push(`${attacker.name} 常胜！获得额外行动`);
            this.showFloatingText(attacker.x, attacker.y, '常胜！', 'heal');
        } else {
            attacker.usedSkill = true;
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
                if (target && target.player !== u.player) {
                    this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
                }
            });
            this.state.logs.push(`${u.name} 选择${skill.name}目标...`);
            this.renderBattle();
            return;
        }

        // 普通单步技能
        this.state.skillPhase = null;
        const range = window.Range.parse(skill.range, u.x, u.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);

        if (skill.category === 'summon') {
            range.forEach(p => {
                if (!this.getUnit(p.x, p.y)) this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            });
        } else {
            range.forEach(p => {
                const target = this.getUnit(p.x, p.y);
                if (target && target.player !== u.player) {
                    this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
                }
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
        this.state.units.forEach(u => {
            if (!u.dead) blockedSet.add(`${u.x},${u.y}`);
        });

        if (!unit.moved) {
            const moveRange = window.Range.parseBlocked(unit.moveRange || '+' + unit.mov, unit.x, unit.y, blockedSet, window.BLOCKING_TERRAIN_MOVE, window.TERRAIN);
            moveRange.forEach(p => {
                if (!this.getUnit(p.x, p.y)) {
                    this.state.highlights.push({ x: p.x, y: p.y, type: 'move' });
                }
            });
        }

        if (!unit.attacked) {
            const attackRange = window.Range.parseBlocked(unit.attackRange || '+1', unit.x, unit.y, blockedSet, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
            attackRange.forEach(p => {
                const target = this.getUnit(p.x, p.y);
                if (target && target.player !== unit.player) {
                    this.state.highlights.push({ x: p.x, y: p.y, type: 'attack' });
                } else if (!target) {
                    this.state.highlights.push({ x: p.x, y: p.y, type: 'attack-range' });
                }
            });
        }
    },

    clearHighlights() {
        this.state.highlights = [];
    },

    // ========================================
    // 回合结束
    // ========================================
    endTurn() {
        this.state.units.forEach(u => {
            u.moved = false;
            u.attacked = false;
            u.usedSkill = false;

            if (!u.dead) {
                // 被动效果：观星 - 每回合开始时治疗友方
                if (u._passive_guanChuan) {
                    this.state.units.forEach(ally => {
                        if (!ally.dead && ally.player === u.player && ally.hp < ally.maxHp) {
                            const heal = 10;
                            ally.hp = Math.min(ally.maxHp, ally.hp + heal);
                            this.state.logs.push(`${ally.name} 观星恢复 +${heal}`);
                        }
                    });
                }

                // 触发充能
                this.triggerSkillCharge(u, 'onTurn');
            }

            // 刷新buff
            if (u.buffs) {
                const newBuffs = [];
                u.buffs.forEach(b => {
                    b.turns--;
                    if (b.turns > 0) newBuffs.push(b);
                    else {
                        if (b.stat === 'atk' || b.stat === 'def') {
                            u[b.stat] -= b.value;
                        }
                    }
                });
                u.buffs = newBuffs;
            }

            // 刷新debuff
            if (u.debuffs) {
                const newDebuffs = [];
                u.debuffs.forEach(d => {
                    d.turns--;
                    if (!u.dead) {
                        if (d.type === 'poison') {
                            u.hp = Math.max(1, u.hp - d.damage);
                            this.state.logs.push(`${u.name} 中毒 -${d.damage}`);
                        }
                        if (d.type === 'burn') {
                            u.hp = Math.max(1, u.hp - d.damage);
                            this.state.logs.push(`${u.name} 燃烧 -${d.damage}`);
                        }
                    }
                    if (d.turns > 0) {
                        newDebuffs.push(d);
                    } else {
                        if (d.type === 'slow') u.mov = d.originalMov || u.mov;
                        if (d.type === 'shredDef') u.def = d.originalDef || u.def;
                        if (d.type === 'confuse') {
                            u.confused = 0;
                            this.state.logs.push(`${u.name} 混乱解除`);
                        }
                        if (d.type === 'silence') {
                            u.silenced = 0;
                            this.state.logs.push(`${u.name} 沉默解除`);
                        }
                    }
                });
                u.debuffs = newDebuffs;
            }

            // 眩晕状态
            if (u.stunned && u.stunned > 0) {
                u.stunned--;
                if (u.stunned <= 0) {
                    u.stunned = 0;
                    this.state.logs.push(`${u.name} 眩晕解除`);
                }
            }
            if (u.confused && u.confused > 0) u.confused--;
            if (u.silenced && u.silenced > 0) u.silenced--;
        });

        // 关羽【威临】光环
        this.state.units.forEach(u => {
            if (u._passive_weiLin && !u.dead) {
                const auraRange2 = window.Range.parse('+2', u.x, u.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
                const auraRange1 = window.Range.parse('+1', u.x, u.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
                this.state.units.forEach(enemy => {
                    if (enemy.dead || enemy.player === u.player) return;
                    const inRange2 = auraRange2.find(p => p.x === enemy.x && p.y === enemy.y);
                    if (inRange2 && !enemy._weiLinDebuffed) {
                        enemy.atk = Math.max(1, enemy.atk - 10);
                        enemy._weiLinDebuffed = true;
                    } else if (!inRange2 && enemy._weiLinDebuffed) {
                        enemy.atk += 10;
                        enemy._weiLinDebuffed = false;
                    }
                    const inRange1 = auraRange1.find(p => p.x === enemy.x && p.y === enemy.y);
                    if (inRange1 && !enemy.silenced) {
                        this.safeEffectCall('silence', u, enemy, 1);
                    }
                });
            }
        });

        this.state.selectedUnit = null;
        this.cancelSkill();

        if (this.state.currentPlayer === 2) {
            this.state.turn++;
            this.state.currentPlayer = 1;
            this.state.logs.push(`第${this.state.turn}回合 红方`);
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
            this.state.units.forEach(u => {
                u.moved = false; u.attacked = false; u.usedSkill = false;
                if (!u.dead) this.triggerSkillCharge(u, 'onTurn');
            });
            this.state.turn++;
            this.state.currentPlayer = 1;
            this.state.logs.push(`第${this.state.turn}回合 红方`);
            this.renderBattle();
        }, 300);
    },

    // 技能充能触发
    triggerSkillCharge(unit, triggerType) {
        if (unit.dead) return;
        const skills = unit.skills || [];
        let charged = false;
        skills.forEach(s => {
            if (s.chargeTrigger === triggerType) {
                unit.energy += 1;
                charged = true;
            }
        });
        if (charged) {
            this.showFloatingText(unit.x, unit.y, '+1能量', 'heal');
        }
    },

    checkWin() {
        const p1Alive = this.state.units.filter(u => u.player === 1 && !u.dead && u.generalId).length;
        const p2Alive = this.state.units.filter(u => u.player === 2 && !u.dead && u.generalId).length;
        if (p1Alive === 0) this.endGame(2);
        else if (p2Alive === 0) this.endGame(1);
    },

    endGame(winner) {
        document.getElementById('winner-text').textContent = `${winner === 1 ? '红方' : '蓝方'} 胜利！`;
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
            skillTarget: null,
            highlights: [],
            logs: [],
            units: [],
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
