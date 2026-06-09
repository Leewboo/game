// =================================================================
// game.js - 纯流程控制
// skill.js 负责技能数据，effect.js 负责效果执行
// 本文件只管：选将、布阵、移动、攻击、技能选择目标、回合流转、胜负判定、AI控制
// =================================================================

const Game = {
    state: {
        mode: 'pvp',         // 'pvp' | 'pve'
        aiPlayer: 2,         // AI 控制的玩家编号
        currentPlayer: 1,
        turn: 1,
        selectedUnit: null,
        currentSkill: null,
        skillPhase: null,     // 'step1' | 'step2'
        skillStep1Target: null,
        highlights: [],
        logs: [],
        units: [],
        players: {
            1: { generals: [], deployed: [] },
            2: { generals: [], deployed: [] }
        }
    },

    // ============================================================
    // 初始化
    // ============================================================
    init() {
        console.log('[Game] init');
        this.bindEvents();
        this.showScreen('menu');
    },

    bindEvents() {
        const el = id => document.getElementById(id);
        if (el('pvp-btn')) el('pvp-btn').onclick = () => { this.state.mode = 'pvp'; this.state.aiPlayer = null; this.startSelect(); };
        if (el('pve-btn')) el('pve-btn').onclick = () => { this.state.mode = 'pve'; this.state.aiPlayer = 2; this.startSelect(); };
        if (el('custom-btn')) el('custom-btn').onclick = () => this.showCustomHelp();
        if (el('confirm-select')) el('confirm-select').onclick = () => this.confirmSelect();
        if (el('end-turn')) el('end-turn').onclick = () => this.endTurn();
        if (el('restart-btn')) el('restart-btn').onclick = () => this.resetGame();
        if (el('close-detail')) el('close-detail').onclick = () => this.hideDetail();
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(id + '-screen');
        if (el) el.classList.add('active');
    },

    // ============================================================
    // 选将阶段
    // ============================================================
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
        const isAI = this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer;
        title.textContent = (isAI ? 'AI（蓝方）' : '玩家（' + (this.state.currentPlayer === 1 ? '红方' : '蓝方') + '）') + ' 选将';
        const selected = this.state.players[this.state.currentPlayer].generals;
        count.textContent = selected.length + '/5';
        confirm.disabled = selected.length < 5;
        confirm.style.display = (isAI ? 'none' : '');

        // 如果是AI选将，延迟执行
        if (isAI) {
            confirm.style.display = 'none';
            list.innerHTML = '<div class="ai-thinking">AI 思考中...</div>';
            setTimeout(() => this.aiSelectGenerals(), 600);
            return;
        }

        list.innerHTML = window.GENERALS.map(g => {
            const isSel = selected.find(s => s.id === g.id);
            const skills = (g.skillIds || []).map(sid => window.SKILLS[sid]).filter(Boolean);
            const passive = skills.find(s => s.type === 'passive');
            const active = skills.find(s => s.type === 'active');
            const passiveDesc = passive ? passive.desc || passive.name : '';
            const activeDesc = active ? active.desc || active.name : '';
            return `<div class="general-card ${isSel ? 'selected' : ''}" data-id="${g.id}">
                <div class="general-icon ${isSel ? 'selected-icon' : ''}">${g.name[0]}</div>
                <div class="general-info">
                    <div class="general-name">${g.name}</div>
                    <div class="general-stats">
                        <span class="stat">❤️${g.hp}</span>
                        <span class="stat">⚔️${g.atk}</span>
                        <span class="stat">🛡️${g.def}</span>
                        <span class="stat">🏃${g.mov}</span>
                    </div>
                    ${passiveDesc ? `<div class="skill-hint passive-hint">🔮 ${passiveDesc.substring(0,20)}...</div>` : ''}
                    ${activeDesc ? `<div class="skill-hint active-hint">⚡ ${activeDesc.substring(0,20)}...</div>` : ''}
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.general-card').forEach(c => {
            c.onclick = () => {
                const id = c.dataset.id;
                const generals = this.state.players[this.state.currentPlayer].generals;
                const idx = generals.findIndex(gg => gg.id === id);
                if (idx >= 0) generals.splice(idx, 1);
                else if (generals.length < 5) generals.push({ ...window.GENERALS.find(gg => gg.id === id) });
                this.renderSelect();
            };
            // 点击详情
            c.ondblclick = () => {
                const g = window.GENERALS.find(gg => gg.id === c.dataset.id);
                if (g) this.showGeneralDetail(g);
            };
        });
    },

    // AI 随机选将
    aiSelectGenerals() {
        const player = this.state.aiPlayer;
        const pool = [...window.GENERALS];
        const selected = [];
        for (let i = 0; i < 5; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            selected.push(pool.splice(idx, 1)[0]);
        }
        this.state.players[player].generals = selected;
        this.state.currentPlayer = 1;
        this.renderSelect();
    },

    confirmSelect() {
        if (this.state.currentPlayer === 1) {
            this.state.currentPlayer = 2;
            this.renderSelect();
        } else {
            this.startDeploy();
        }
    },

    // ============================================================
    // 布阵阶段
    // ============================================================
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
        const isAI = this.state.mode === 'pve' && player === this.state.aiPlayer;
        document.getElementById('deploy-title').textContent = (isAI ? 'AI（蓝方）' : '玩家（' + (player === 1 ? '红方' : '蓝方') + '）') + ' 布阵';
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
                cell.dataset.x = x; cell.dataset.y = y;
                const label = window.TERRAIN_LABELS[window.TERRAIN[y][x]];
                if (label) cell.innerHTML = `<span class="terrain-label">${label}</span>`;
                const u = this.getUnit(x, y);
                if (u) {
                    cell.innerHTML += `<div class="unit p${u.player}"><div class="unit-icon">${u.name[0]}</div></div>`;
                }
                cell.onclick = () => this.handleDeployClick(x, y);
                board.appendChild(cell);
            }
        }
        const generals = this.state.players[player].generals;
        document.getElementById('deploy-list').innerHTML = generals.map((g, i) => {
            const isDeployed = deployed.find(d => d.generalId === g.id);
            return `<div class="mini-general ${isDeployed ? 'deployed' : ''}" data-idx="${i}">${g.name}</div>`;
        }).join('');

        // AI 自动布阵
        if (isAI) {
            setTimeout(() => this.aiDeploy(), 500);
        }
    },

    aiDeploy() {
        const player = this.state.aiPlayer;
        const deployed = this.state.players[player].deployed;
        const generals = this.state.players[player].generals;
        const rows = player === 1 ? window.BOARD_SIZE - 3 : 0;

        generals.forEach(g => {
            if (deployed.find(d => d.generalId === g.id)) return;
            for (let y = rows; y < rows + 3; y++) {
                for (let x = 0; x < window.BOARD_SIZE; x++) {
                    if (this.getUnit(x, y)) continue;
                    // 避开山川
                    if (window.TERRAIN_NAMES[window.TERRAIN[y][x]] === 'mountain') continue;
                    if (this.getUnit(x, y)) continue;
                    this.createUnit(g, player, x, y);
                    deployed.push({ generalId: g.id });
                    break;
                }
                if (deployed.find(d => d.generalId === g.id)) break;
            }
        });

        if (deployed.length === 5) {
            this.startBattle();
        }
    },

    handleDeployClick(x, y) {
        const player = this.state.currentPlayer;
        if (player === 1 && y < window.BOARD_SIZE - 3) return;
        if (player === 2 && y > 2) return;
        if (this.getUnit(x, y)) return;
        const generals = this.state.players[player].generals;
        const deployed = this.state.players[player].deployed;
        const next = generals.find(g => !deployed.find(d => d.generalId === g.id));
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

    // ============================================================
    // 战斗阶段
    // ============================================================
    startBattle() {
        this.state.units.forEach(u => this.runPassive(u, 'init'));
        this.state.units.forEach(u => {
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
        this.state.logs = ['⚔️ 战斗开始！'];
        this.renderBattle();
        this.showScreen('battle');

        // 如果是AI先手
        if (this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer) {
            setTimeout(() => this.aiTurn(), 800);
        }
    },

    createUnit(generalData, player, x, y) {
        const skills = window.SkillResolver.resolve(generalData.skillIds);
        const unit = {
            id: Date.now() + Math.random(),
            generalId: generalData.id,
            name: generalData.name,
            data: generalData,
            player,
            x, y,
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

    // ============================================================
    // 被动触发（统一入口）
    // ============================================================
    runPassive(unit, trigger, context = {}) {
        if (!unit || unit.dead || !unit.skills) return [];
        const results = [];
        unit.skills.forEach(skill => {
            if (skill.type !== 'passive' && !skill.passive) return;
            (skill.passive || []).forEach(p => {
                if (p.trigger === trigger) {
                    const res = window.Effect.execute(p.effects, unit, context.target || null, this.state);
                    if (res) results.push(...(Array.isArray(res) ? res : [res]));
                }
            });
        });
        return results;
    },

    // ============================================================
    // 战斗界面渲染
    // ============================================================
    renderBattle() {
        document.getElementById('turn-info').textContent = `第${this.state.turn}回合 | ${this.state.currentPlayer === 1 ? '🔴红方' : '🔵蓝方'}`;

        // 结束按钮文字
        const endBtn = document.getElementById('end-turn');
        if (endBtn) {
            const isAI = this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer;
            endBtn.textContent = isAI ? 'AI 行动中...' : '结束回合';
            endBtn.disabled = isAI;
        }

        const board = document.getElementById('battle-board');
        board.innerHTML = '';
        for (let y = 0; y < window.BOARD_SIZE; y++) {
            for (let x = 0; x < window.BOARD_SIZE; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell ' + window.TERRAIN_NAMES[window.TERRAIN[y][x]];
                const hl = this.state.highlights.find(h => h.x === x && h.y === y);
                if (hl) cell.classList.add('highlight-' + hl.type);
                cell.dataset.x = x; cell.dataset.y = y;
                const label = window.TERRAIN_LABELS[window.TERRAIN[y][x]];
                if (label) cell.innerHTML = `<span class="terrain-label">${label}</span>`;
                const u = this.getUnit(x, y);
                if (u) {
                    const hpPercent = ((u.hp / u.maxHp) * 100).toFixed(0);
                    const selected = this.state.selectedUnit && this.state.selectedUnit.id === u.id ? ' selected' : '';
                    const hpColor = hpPercent > 60 ? '#4caf50' : hpPercent > 30 ? '#ff9800' : '#f44336';
                    const activeSkill = u.skills.find(s => s.type === 'active');
                    const passiveSkill = u.skills.find(s => s.type === 'passive');
                    const skillIcon = activeSkill ? '⚡' : (passiveSkill ? '🔮' : '');
                    cell.innerHTML += `<div class="unit p${u.player}${selected}">
                        <div class="unit-icon">${u.name[0]}${skillIcon ? `<span class="unit-skill-dot">${skillIcon}</span>` : ''}</div>
                        <div class="unit-hp"><div class="unit-hp-fill" style="width:${hpPercent}%;background:${hpColor}"></div></div>
                        <div class="unit-energy">${u.energy > 0 ? '◆' + u.energy : ''}</div>
                    </div>`;
                }
                cell.onclick = () => this.handleBattleClick(x, y);
                board.appendChild(cell);
            }
        }
        this.renderPlayerBars();
        this.renderSelectedInfo();
        const logPanel = document.getElementById('log-panel');
        if (logPanel) logPanel.innerHTML = this.state.logs.slice(-12).map(l => `<div class="log-entry">${l}</div>`).join('');
    },

    // 顶部武将栏：含名字、血条、能量指示
    renderPlayerBars() {
        [1, 2].forEach(player => {
            const bar = document.getElementById(`player${player}-generals`);
            if (!bar) return;
            const units = this.state.units.filter(u => u.player === player && !u.dead);
            bar.innerHTML = units.map(u => {
                const hpPercent = ((u.hp / u.maxHp) * 100).toFixed(0);
                const hpColor = hpPercent > 60 ? '#4caf50' : hpPercent > 30 ? '#ff9800' : '#f44336';
                const activeSkills = u.skills.filter(s => s.type === 'active');
                const passiveSkill = u.skills.find(s => s.type === 'passive');
                const skillDescs = [];
                if (passiveSkill) skillDescs.push('🔮' + (passiveSkill.name || ''));
                activeSkills.forEach(s => skillDescs.push('⚡' + (s.name || '')));
                const selected = this.state.selectedUnit && this.state.selectedUnit.id === u.id ? ' selected-bar' : '';
                return `<div class="bar-general${selected}" data-unit-id="${u.id}">
                    <div class="bar-general-name">${u.name}</div>
                    <div class="bar-general-stats">
                        <span class="bar-stat">⚔️${u.atk}</span>
                        <span class="bar-stat">🛡️${u.def}</span>
                    </div>
                    <div class="bar-general-hp"><div class="bar-general-hp-fill" style="width:${hpPercent}%;background:${hpColor}"></div></div>
                    <div class="bar-general-skills">${skillDescs.slice(0,2).join(' ')}</div>
                    <div class="bar-general-energy">${u.energy > 0 ? '◆' + u.energy : ''}</div>
                </div>`;
            }).join('');
            // 点击武将栏选中
            bar.querySelectorAll('.bar-general').forEach(el => {
                el.onclick = () => {
                    const uid = parseFloat(el.dataset.unitId);
                    const u = this.state.units.find(uu => uu.id === uid);
                    if (!u) return;
                    this.state.selectedUnit = u;
                    this.cancelSkill();
                    this.showMovesAndAttacks(u);
                    this.renderBattle();
                };
            });
        });
    },

    // 选中武将信息面板
    renderSelectedInfo() {
        const container = document.getElementById('selected-info');
        if (!container) return;
        const u = this.state.selectedUnit;
        if (!u) { container.classList.add('hidden'); return; }
        container.classList.remove('hidden');

        const hpPercent = ((u.hp / u.maxHp) * 100).toFixed(0);
        const passive = u.skills.find(s => s.type === 'passive');
        const activeSkills = u.skills.filter(s => s.type === 'active');

        let skillsHtml = '';
        u.skills.forEach(s => {
            const isActive = s.type === 'active';
            const cost = s.energyCost || 0;
            const disabled = isActive && ((cost > 0 && u.energy < cost) || u.usedSkill || u.silenced);
            skillsHtml += `<div class="skill-card ${isActive ? 'active-skill' : 'passive-skill'}">
                <div class="skill-name-row">
                    <span class="skill-name">${isActive ? '⚡' : '🔮'} ${s.name || s.id}</span>
                    ${isActive ? `<span class="skill-cost">${cost ? '◆' + cost : '无消耗'}</span>` : ''}
                </div>
                <div class="skill-desc">${s.desc || ''}</div>
                ${isActive ? `<button class="sel-skill-btn ${disabled ? 'disabled' : ''}" data-skill="${s.id}">使用技能</button>` : ''}
            </div>`;
        });

        container.innerHTML = `
            <div class="selected-header">
                <div class="sel-name">${u.name}</div>
                <div class="sel-hp-row">
                    <span>❤️ ${u.hp}/${u.maxHp}</span>
                    <div class="sel-hp-bar"><div class="sel-hp-fill" style="width:${hpPercent}%"></div></div>
                    <span>⚔️${u.atk}</span>
                    <span>🛡️${u.def}</span>
                    <span>🏃${u.mov}</span>
                    <span>◆${u.energy}</span>
                </div>
                <div class="sel-status">
                    ${u.moved ? '✅已移动' : ''}
                    ${u.attacked ? '⚔️已攻击' : ''}
                    ${u.usedSkill ? '⚡已技能' : ''}
                    ${u.stunned ? '😵眩晕' : ''}
                    ${u.silenced ? '🔇沉默' : ''}
                    ${u.confused ? '😵‍💫混乱' : ''}
                </div>
            </div>
            <div class="selected-skills">${skillsHtml}</div>
        `;

        container.querySelectorAll('.sel-skill-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.classList.contains('disabled')) return;
                const skill = u.skills.find(s => s.id === btn.dataset.skill);
                this.selectSkill(skill);
            };
        });
    },

    // 武将详情弹窗（双击武将卡片时）
    showGeneralDetail(g) {
        const panel = document.getElementById('detail-panel');
        const nameEl = document.getElementById('detail-name');
        const statsEl = document.getElementById('detail-stats');
        const skillsEl = document.getElementById('detail-skills');
        if (!panel) return;

        nameEl.textContent = g.name;
        statsEl.innerHTML = `❤️生命:${g.hp} | ⚔️攻击:${g.atk} | 🛡️防御:${g.def} | 🏃移动:${g.mov}`;

        const skills = (g.skillIds || []).map(sid => window.SKILLS[sid]).filter(Boolean);
        skillsEl.innerHTML = skills.map(s => {
            if (s.type === 'passive') {
                return `<div class="detail-skill">
                    <div class="detail-skill-title">🔮 ${s.name || s.id}（被动）</div>
                    <div class="detail-skill-desc">${s.desc || ''}</div>
                </div>`;
            }
            return `<div class="detail-skill">
                <div class="detail-skill-title">⚡ ${s.name || s.id}（主动）${s.energyCost ? '◆' + s.energyCost : ''}</div>
                <div class="detail-skill-desc">${s.desc || ''}</div>
                <div class="detail-skill-range">范围: ${s.range || '+1'}</div>
            </div>`;
        }).join('');
        panel.classList.remove('hidden');
    },

    hideDetail() {
        const panel = document.getElementById('detail-panel');
        if (panel) panel.classList.add('hidden');
    },

    // ============================================================
    // 战斗点击处理
    // ============================================================
    handleBattleClick(x, y) {
        // 如果是AI回合，忽略点击
        if (this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer) return;

        const unit = this.getUnit(x, y);
        const hl = this.state.highlights.find(h => h.x === x && h.y === y);

        // 多步技能 step2：选落点
        if (this.state.skillPhase === 'step2' && this.state.currentSkill) {
            if (hl && hl.type === 'skill') { this.executeStep2Skill(x, y); return; }
            this.cancelSkill(); this.renderBattle(); return;
        }

        // 多步技能 step1：选敌人
        if (this.state.skillPhase === 'step1' && this.state.currentSkill) {
            if (hl && hl.type === 'skill' && unit) { this.executeStep1Target(x, y, unit); return; }
            this.cancelSkill(); this.renderBattle(); return;
        }

        // 移动
        if (hl && hl.type === 'move' && this.state.selectedUnit) {
            this.executeMove(this.state.selectedUnit, x, y); return;
        }

        // 普通攻击
        if (hl && hl.type === 'attack' && this.state.selectedUnit && unit && unit.player !== this.state.selectedUnit.player) {
            this.executeAttack(this.state.selectedUnit, unit); return;
        }

        // 技能
        if (hl && hl.type === 'skill' && this.state.selectedUnit && this.state.currentSkill) {
            this.executeSkillOnCell(x, y, unit); return;
        }

        // 选择己方单位
        if (unit && unit.player === this.state.currentPlayer) {
            if (unit.stunned) { this.state.logs.push('⛔ ' + unit.name + ' 处于眩晕状态'); this.renderBattle(); return; }
            this.state.selectedUnit = unit;
            this.cancelSkill();
            this.showMovesAndAttacks(unit);
            this.renderBattle();
            return;
        }

        // 点空白取消
        this.state.selectedUnit = null;
        this.cancelSkill();
        this.renderBattle();
    },

    // ============================================================
    // 移动
    // ============================================================
    executeMove(unit, x, y) {
        unit.x = x; unit.y = y; unit.moved = true;
        this.runPassive(unit, 'afterMove');
        this.runPassive(unit, 'afterAction');
        this.clearHighlights();
        this.state.logs.push(`🏃 ${unit.name} 移动至(${x},${y})`);
        this.showMovesAndAttacks(unit);
        this.renderBattle();
        if (this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer) {
            setTimeout(() => this.aiTurn(), 300);
        }
    },

    // ============================================================
    // 普通攻击
    // ============================================================
    executeAttack(attacker, target) {
        const results = window.Effect.execute(
            [{ effectKey: 'damage', targetType: 'target', params: { amount: attacker.atk } }],
            attacker, target, this.state
        );
        attacker.attacked = true;
        this.runPassive(attacker, 'afterAttack');
        this.runPassive(attacker, 'afterAction');

        const dmg = results[0] && results[0].amount || 0;
        if (target.dead) {
            this.state.logs.push(`💀 ${attacker.name} 击杀 ${target.name}`);
            this.runPassive(attacker, 'onKill', { target, killed: true });
        } else {
            this.state.logs.push(`⚔️ ${attacker.name} 攻击 ${target.name}，造成 ${dmg} 点伤害`);
        }

        // 反击
        if (target.counterRate && !target.dead && Math.random() < target.counterRate) {
            const cd = Math.max(1, Math.floor(target.atk * 0.5 - attacker.def * 0.3));
            attacker.hp -= cd;
            if (attacker.hp <= 0) { attacker.hp = 0; attacker.dead = true; }
            this.state.logs.push(`🔄 ${target.name} 反击 ${attacker.name} -${cd}`);
            this.showFloat(attacker.x, attacker.y, `-${cd}`, 'damage');
        }

        this.showFloat(target.x, target.y, `-${dmg}`, 'damage');
        this.clearHighlights();
        this.checkWin();
        this.renderBattle();

        if (this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer) {
            setTimeout(() => this.aiTurn(), 400);
        }
    },

    // ============================================================
    // 主动技能选择
    // ============================================================
    selectSkill(skill) {
        this.state.currentSkill = skill;
        this.clearHighlights();
        const u = this.state.selectedUnit;

        // 多步技能：先选敌人
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
        cells.forEach(p => {
            const u = this.getUnit(p.x, p.y);
            if (side === 'enemy' && u && u.player !== this.state.selectedUnit.player && !u.dead)
                this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
            if (side === 'ally' && u && u.player === this.state.selectedUnit.player && !u.dead)
                this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
        });
    },

    highlightEmpty(rangeStr) {
        const cells = window.Range.parse(rangeStr, this.state.selectedUnit.x, this.state.selectedUnit.y, window.BLOCKING_TERRAIN_MOVE, window.TERRAIN);
        cells.forEach(p => {
            if (!this.getUnit(p.x, p.y) && !window.BLOCKING_TERRAIN_MOVE.has(window.TERRAIN[p.y] && window.TERRAIN[p.y][p.x]))
                this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
        });
    },

    executeSkillOnCell(x, y, unit) {
        const skill = this.state.currentSkill;
        const caster = this.state.selectedUnit;
        if (skill.energyCost) caster.energy -= skill.energyCost;

        const replacedEffects = (skill.effects || []).map(e => {
            if (!e.params) return e;
            const p = { ...e.params };
            if (p.x === '__targetX__') p.x = x;
            if (p.y === '__targetY__') p.y = y;
            return { ...e, params: p };
        });

        const target = unit || { x, y };
        const results = window.Effect.execute(replacedEffects, caster, target, this.state);
        caster.usedSkill = true;

        results.forEach(r => {
            if (r.targetId) {
                const killedUnit = this.state.units.find(uu => uu.id === r.targetId);
                if (killedUnit && killedUnit.dead) {
                    this.state.logs.push(`💀 ${caster.name} 击杀 ${killedUnit.name}`);
                    this.runPassive(caster, 'onKill', { target: killedUnit, killed: true });
                }
            }
        });

        this.runPassive(caster, 'afterAction');
        this.state.logs.push(`⚡ ${caster.name} 使用「${skill.name}」`);
        this.cancelSkill();
        this.checkWin();
        this.renderBattle();

        if (this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer) {
            setTimeout(() => this.aiTurn(), 400);
        }
    },

    executeStep1Target(x, y, unit) {
        this.state.skillStep1Target = unit;
        this.state.skillPhase = 'step2';
        this.clearHighlights();
        const skill = this.state.currentSkill;
        const range = window.Range.parse(skill.selectStep2Range, unit.x, unit.y, null, window.TERRAIN);
        range.forEach(p => {
            const ty = window.TERRAIN[p.y];
            if (!ty) return;
            if (!this.getUnit(p.x, p.y) && !window.BLOCKING_TERRAIN_MOVE.has(ty[p.x]))
                this.state.highlights.push({ x: p.x, y: p.y, type: 'skill' });
        });
        this.state.logs.push(`🎯 ${unit.name} 为「${skill.name}」的目标`);
        this.renderBattle();
    },

    executeStep2Skill(x, y) {
        const skill = this.state.currentSkill;
        const caster = this.state.selectedUnit;
        const target = this.state.skillStep1Target;
        if (skill.energyCost) caster.energy -= skill.energyCost;

        const replacedEffects = (skill.effects || []).map(e => {
            if (!e.params) return e;
            const p = { ...e.params };
            if (p.x === '__landingX__') p.x = x;
            if (p.y === '__landingY__') p.y = y;
            return { ...e, params: p };
        });

        const results = window.Effect.execute(replacedEffects, caster, target, this.state);
        caster.usedSkill = true;

        results.forEach(r => {
            if (r.targetId) {
                const killed = this.state.units.find(uu => uu.id === r.targetId);
                if (killed && killed.dead) {
                    this.state.logs.push(`💀 ${caster.name} 击杀 ${killed.name}`);
                    this.runPassive(caster, 'onKill', { target: killed, killed: true });
                }
            }
        });

        this.runPassive(caster, 'afterAction');
        this.state.logs.push(`⚡ ${caster.name} 使用「${skill.name}」突进至(${x},${y})`);
        this.cancelSkill();
        this.checkWin();
        this.renderBattle();

        if (this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer) {
            setTimeout(() => this.aiTurn(), 400);
        }
    },

    cancelSkill() {
        this.state.currentSkill = null;
        this.state.skillPhase = null;
        this.state.skillStep1Target = null;
        this.clearHighlights();
    },

    // ============================================================
    // 高亮可移动 / 可攻击格子
    // ============================================================
    showMovesAndAttacks(unit) {
        this.clearHighlights();
        const blockedMove = new Set();
        this.state.units.forEach(uu => { if (!uu.dead) blockedMove.add(uu.x + ',' + uu.y); });

        if (!unit.moved) {
            const cells = window.Range.parseBlocked(unit.moveRange, unit.x, unit.y, blockedMove, window.BLOCKING_TERRAIN_MOVE, window.TERRAIN);
            cells.forEach(p => {
                if (!this.getUnit(p.x, p.y)) this.state.highlights.push({ x: p.x, y: p.y, type: 'move' });
            });
        }

        if (!unit.attacked) {
            const cells = window.Range.parse(unit.attackRange, unit.x, unit.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
            cells.forEach(p => {
                const u = this.getUnit(p.x, p.y);
                if (u && u.player !== unit.player && !u.dead)
                    this.state.highlights.push({ x: p.x, y: p.y, type: 'attack' });
            });
        }
    },

    clearHighlights() { this.state.highlights = []; },

    // ============================================================
    // 回合结束
    // ============================================================
    endTurn() {
        if (this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer) return;

        this.state.units.forEach(u => {
            if (u.player === this.state.currentPlayer) {
                window.Effect.tickDebuffs(u, this.state);
                window.Effect.tickBuffs(u, this.state);
            }
        });

        this.state.currentPlayer = this.state.currentPlayer === 1 ? 2 : 1;
        if (this.state.currentPlayer === 1) this.state.turn++;

        this.state.units.forEach(u => {
            if (u.player === this.state.currentPlayer && !u.dead) {
                u.moved = false; u.attacked = false; u.usedSkill = false;
                this.runPassive(u, 'onTurnStart');
            }
        });

        // 充能：chargeTrigger='onTurn'
        this.state.units.forEach(u => {
            if (u.player !== this.state.currentPlayer || u.dead) return;
            (u.skills || []).forEach(s => {
                if (s.type === 'active' && s.chargeTrigger === 'onTurn') {
                    u.energy = (u.energy || 0) + 1;
                }
            });
        });

        this.state.selectedUnit = null;
        this.cancelSkill();
        this.checkWin();
        this.state.logs.push(`--- 第${this.state.turn}回合 ${this.state.currentPlayer === 1 ? '🔴红方' : '🔵蓝方'} ---`);
        this.renderBattle();

        if (this.state.mode === 'pve' && this.state.currentPlayer === this.state.aiPlayer) {
            setTimeout(() => this.aiTurn(), 800);
        }
    },

    // ============================================================
    // AI 逻辑
    // ============================================================
    aiTurn() {
        if (this.checkWinCalled) return;
        const aiUnits = this.state.units.filter(u => u.player === this.state.aiPlayer && !u.dead && !u.stunned);
        if (aiUnits.length === 0) {
            this.endTurn(); return;
        }
        this.aiActSequentially(aiUnits, 0);
    },

    aiActSequentially(units, idx) {
        if (idx >= units.length) {
            this.endTurn(); return;
        }
        const unit = units[idx];
        if (unit.dead || unit.stunned) {
            this.aiActSequentially(units, idx + 1); return;
        }
        this.state.selectedUnit = unit;
        this.state.logs.push(`🤖 AI 控制 ${unit.name}`);
        this.renderBattle();

        setTimeout(() => {
            // 1. 尝试使用技能
            const usableSkill = this.findUsableSkill(unit);
            if (usableSkill) {
                this.aiUseSkill(unit, usableSkill, () => {
                    setTimeout(() => this.aiActSequentially(units, idx + 1), 400);
                });
                return;
            }
            // 2. 移动 + 攻击
            const moved = this.aiMove(unit);
            setTimeout(() => {
                const attacked = this.aiAttack(unit);
                setTimeout(() => this.aiActSequentially(units, idx + 1), 400);
            }, moved ? 300 : 0);
        }, 500);
    },

    findUsableSkill(unit) {
        if (unit.usedSkill || unit.silenced) return null;
        const actives = unit.skills.filter(s => s.type === 'active');
        // 优先选有能量且有可用目标的
        for (const s of actives) {
            if (s.energyCost && unit.energy < s.energyCost) continue;
            // 检查是否有可用目标
            const cells = window.Range.parse(s.range, unit.x, unit.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
            const hasTarget = cells.some(p => {
                const u = this.getUnit(p.x, p.y);
                return u && u.player !== unit.player;
            });
            if (hasTarget) return s;
        }
        return null;
    },

    aiUseSkill(unit, skill, cb) {
        const cells = window.Range.parse(skill.range, unit.x, unit.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
        const enemies = [];
        cells.forEach(p => {
            const u = this.getUnit(p.x, p.y);
            if (u && u.player !== unit.player) enemies.push(u);
        });
        if (enemies.length === 0) { cb(); return; }

        // 选HP最低的敌人
        const target = enemies.reduce((a, b) => a.hp < b.hp ? a : b);

        if (skill.selectStep1 === 'enemy') {
            this.state.currentSkill = skill;
            this.state.skillPhase = 'step1';
            this.state.skillStep1Target = target;
            this.state.skillPhase = 'step2';
            // 找落点
            const range2 = window.Range.parse(skill.selectStep2Range, target.x, target.y, null, window.TERRAIN);
            const empty = range2.find(p => {
                const ty = window.TERRAIN[p.y];
                if (!ty) return false;
                return !this.getUnit(p.x, p.y) && !window.BLOCKING_TERRAIN_MOVE.has(ty[p.x]);
            });
            if (empty) {
                this.executeStep2Skill(empty.x, empty.y);
            } else {
                this.cancelSkill();
            }
        } else {
            this.selectSkill(skill);
            this.executeSkillOnCell(target.x, target.y, target);
        }
        cb();
    },

    aiMove(unit) {
        if (unit.moved) return false;
        const blockedMove = new Set();
        this.state.units.forEach(uu => { if (!uu.dead) blockedMove.add(uu.x + ',' + uu.y); });
        const cells = window.Range.parseBlocked(unit.moveRange, unit.x, unit.y, blockedMove, window.BLOCKING_TERRAIN_MOVE, window.TERRAIN);

        // 找最近的敌方单位
        const enemies = this.state.units.filter(u => !u.dead && u.player !== unit.player);
        if (enemies.length === 0) return false;

        let best = null, bestDist = Infinity;
        enemies.forEach(e => {
            cells.forEach(p => {
                const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
                if (d < bestDist) { bestDist = d; best = p; }
            });
        });

        if (best) {
            unit.x = best.x; unit.y = best.y; unit.moved = true;
            this.runPassive(unit, 'afterMove');
            this.runPassive(unit, 'afterAction');
            this.state.logs.push(`🤖 ${unit.name} 移动至(${best.x},${best.y})`);
            this.renderBattle();
            return true;
        }
        return false;
    },

    aiAttack(unit) {
        if (unit.attacked) return false;
        const cells = window.Range.parse(unit.attackRange, unit.x, unit.y, window.BLOCKING_TERRAIN_ATTACK, window.TERRAIN);
        const enemies = [];
        cells.forEach(p => {
            const u = this.getUnit(p.x, p.y);
            if (u && u.player !== unit.player) enemies.push(u);
        });
        if (enemies.length === 0) return false;

        const target = enemies.reduce((a, b) => a.hp < b.hp ? a : b);
        this.executeAttack(unit, target);
        return true;
    },

    // ============================================================
    // 辅助
    // ============================================================
    showFloat(x, y, text, type) {
        const cell = document.querySelector(`#battle-board .cell[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        const el = document.createElement('div');
        el.className = 'float-text ' + type;
        el.textContent = text;
        cell.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },

    getUnit(x, y) {
        return this.state.units.find(u => u.x === x && u.y === y && !u.dead);
    },

    checkWinCalled: false,

    checkWin() {
        const p1 = this.state.units.filter(u => u.player === 1 && !u.dead && u.generalId);
        const p2 = this.state.units.filter(u => u.player === 2 && !u.dead && u.generalId);
        if (p1.length === 0) this.endGame(2);
        else if (p2.length === 0) this.endGame(1);
    },

    endGame(winner) {
        this.checkWinCalled = true;
        const winnerText = document.getElementById('winner-text');
        const isPve = this.state.mode === 'pve';
        if (isPve) {
            winnerText.textContent = winner === 1 ? '🎉 恭喜！你战胜了AI！' : '🤖 AI 战胜了你！';
        } else {
            winnerText.textContent = (winner === 1 ? '🔴红方' : '🔵蓝方') + ' 胜利！';
        }
        this.showScreen('gameover');
    },

    resetGame() {
        this.checkWinCalled = false;
        this.state = {
            mode: 'pvp', aiPlayer: 2, currentPlayer: 1, turn: 1,
            selectedUnit: null, currentSkill: null, skillPhase: null,
            skillStep1Target: null,
            highlights: [], logs: [], units: [],
            players: { 1: { generals: [], deployed: [] }, 2: { generals: [], deployed: [] } }
        };
        this.showScreen('menu');
    },

    showCustomHelp() {
        alert('DIY 武将/技能教程：\n\n打开浏览器控制台 (F12)，输入：\n\nwindow.addCustomSkill({\n  id:"mySkill",\n  name:"我的技能",\n  type:"active",\n  range:"+3",\n  category:"damage",\n  energyCost:2,\n  desc:"对目标造成50伤害",\n  effects:[\n    {effectKey:"damage", targetType:"target", params:{amount:50}}\n  ]\n});\n\nwindow.addCustomGeneral({\n  id:"myGeneral",\n  name:"自定义武将",\n  hp:150, atk:40, def:20, mov:3,\n  skillIds:["mySkill"]\n});\n\n刷新页面即可使用！');
    }
};

window.Game = Game;

window.addCustomSkill = function(skillDef) {
    if (!skillDef || !skillDef.id) return console.error('[DIY] 需要 id 字段');
    window.SKILLS[skillDef.id] = skillDef;
    console.log('[DIY] ✅ 技能已注册:', skillDef.id, skillDef);
};

window.addCustomGeneral = function(generalDef) {
    if (!generalDef || !generalDef.id) return console.error('[DIY] 需要 id 字段');
    window.GENERALS.push(generalDef);
    console.log('[DIY] ✅ 武将已注册:', generalDef.id, generalDef);
};

document.addEventListener('DOMContentLoaded', () => Game.init());
