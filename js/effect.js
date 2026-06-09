// =================================================================
// effect.js - 通用效果库（纯效果函数 + 工具方法）
// 所有 effect 都由 window.Effect 暴露，游戏流程调用时传入：
//   effectKey: 效果名（如 damage / heal / poison / slow 等）
//   params: { amount, turns, stat, value, type, targetType, ... }
//   target: 目标单位
//   caster: 释放者
//   state: 游戏全局状态
// =================================================================

window.Effect = {
    _id: 0,
    nextId() { return ++this._id; },

    // ============================================================
    // 基础伤害/治疗
    // ============================================================
    damage(params, target, caster, state) {
        if (!target || target.dead) return { applied: false };
        const amount = params.amount || 10;
        const finalAmount = Math.max(1, Math.floor(amount - (target.def || 0) * (params.defFactor || 0.3)));
        target.hp = Math.max(0, target.hp - finalAmount);
        if (target.hp <= 0) target.dead = true;
        return { applied: true, type: 'damage', amount: finalAmount, targetId: target.id };
    },

    heal(params, target, caster, state) {
        if (!target || target.dead) return { applied: false };
        const amount = params.amount || 10;
        const max = target.maxHp || target.hp;
        const before = target.hp;
        target.hp = Math.min(max, target.hp + amount);
        return { applied: true, type: 'heal', amount: target.hp - before, targetId: target.id };
    },

    // 基础伤害 + 可配置防御系数
    basicDamage(params, target, caster, state) {
        return this.damage({
            amount: params.amount,
            defFactor: params.defFactor !== undefined ? params.defFactor : 0.3
        }, target, caster, state);
    },

    // ============================================================
    // 属性修改 buff / debuff
    // ============================================================
    modifyStat(params, target, caster, state) {
        if (!target) return { applied: false };
        const stat = params.stat; // 'atk' / 'def' / 'mov' / 'maxHp'
        const value = params.value || 0;
        const turns = params.turns || 0;
        target[stat] = (target[stat] || 0) + value;
        if (turns > 0) {
            if (!target.buffs) target.buffs = [];
            target.buffs.push({ id: this.nextId(), effect: 'modifyStat', stat, value, turns });
        }
        return { applied: true, type: 'modifyStat', stat, value, targetId: target.id };
    },

    // ============================================================
    // 状态标记（眩晕、沉默、混乱等）
    // ============================================================
    markStatus(params, target, caster, state) {
        if (!target || target.dead) return { applied: false };
        const status = params.status; // 'stun' / 'silence' / 'confuse' / 'burn' / 'poison' / 'slow' / 'shredDef'
        const turns = params.turns || 1;
        if (!target.debuffs) target.debuffs = [];
        const entry = { id: this.nextId(), type: status, turns };
        if (params.value !== undefined) entry.value = params.value;
        if (params.amount !== undefined) entry.amount = params.amount;
        if (status === 'slow') { entry.originalMov = target.mov; target.mov = Math.max(1, target.mov - (params.amount || 1)); }
        if (status === 'shredDef') { entry.originalDef = target.def; target.def = Math.max(0, target.def - (params.amount || 10)); }
        if (status === 'stun') target.stunned = Math.max(target.stunned || 0, turns);
        if (status === 'silence') target.silenced = Math.max(target.silenced || 0, turns);
        if (status === 'confuse') target.confused = Math.max(target.confused || 0, turns);
        target.debuffs.push(entry);
        return { applied: true, type: 'markStatus', status, turns, targetId: target.id };
    },

    // ============================================================
    // 被动标记（给单位打 flag，用于后续检测）
    // 例：flag='_passive_changSheng', value=true
    // ============================================================
    markFlag(params, target, caster, state) {
        if (!target) return { applied: false };
        target[params.flag] = params.value !== undefined ? params.value : true;
        return { applied: true, type: 'markFlag', flag: params.flag, value: params.value, targetId: target.id };
    },

    // ============================================================
    // 移动 / 突进 / 换位
    // ============================================================
    moveTo(params, target, caster, state) {
        if (!target) return { applied: false };
        const x = params.x !== undefined ? params.x : target.x;
        const y = params.y !== undefined ? params.y : target.y;
        target.x = x; target.y = y;
        return { applied: true, type: 'moveTo', x, y, targetId: target.id };
    },

    // 朝目标方向突进一格（或多格）
    dash(params, target, caster, state) {
        if (!target || !caster) return { applied: false };
        const dx = Math.sign(target.x - caster.x);
        const dy = Math.sign(target.y - caster.y);
        const steps = params.steps || 1;
        caster.x = caster.x + dx * steps;
        caster.y = caster.y + dy * steps;
        return { applied: true, type: 'dash', targetId: target.id };
    },

    // ============================================================
    // 召唤
    // ============================================================
    summon(params, target, caster, state) {
        const unitType = params.unitType; // 'soldier' / 'archer' / 'wall'
        const def = window.SUMMONS && window.SUMMONS[unitType];
        if (!def) return { applied: false };
        const x = params.x !== undefined ? params.x : (target ? target.x : caster.x);
        const y = params.y !== undefined ? params.y : (target ? target.y : caster.y);
        const unit = {
            id: this.nextId(), name: def.name, player: caster.player, x, y,
            hp: def.hp, maxHp: def.hp, atk: def.atk, def: def.def, mov: def.mov,
            moveRange: '+' + def.mov, attackRange: '+1', energy: 0, skills: [],
            dead: false, moved: false, attacked: false, usedSkill: false, isSummon: true
        };
        if (state.units) state.units.push(unit);
        return { applied: true, type: 'summon', unitId: unit.id };
    },

    // ============================================================
    // 重置行动机会（常胜/极速）
    // ============================================================
    grantExtraAction(params, target, caster, state) {
        if (!target) return { applied: false };
        target.moved = false; target.attacked = false;
        return { applied: true, type: 'grantExtraAction', targetId: target.id };
    },

    // ============================================================
    // 增加能量（用于充能技）
    // ============================================================
    addEnergy(params, target, caster, state) {
        if (!target) return { applied: false };
        target.energy = (target.energy || 0) + (params.amount || 1);
        return { applied: true, type: 'addEnergy', amount: params.amount || 1, targetId: target.id };
    },

    // ============================================================
    // 位移 / 击退
    // ============================================================
    knockback(params, target, caster, state) {
        if (!target || !caster) return { applied: false };
        const dx = Math.sign(target.x - caster.x);
        const dy = Math.sign(target.y - caster.y);
        const steps = params.steps || 1;
        target.x = target.x + dx * steps;
        target.y = target.y + dy * steps;
        return { applied: true, type: 'knockback', targetId: target.id };
    },

    // ============================================================
    // 通用：根据 targetId / casterId 在 state 中找单位
    // ============================================================
    findUnit(id, state) {
        if (!state || !state.units) return null;
        return state.units.find(u => u.id == id);
    },

    // ============================================================
    // 回合结算：持续伤害(burn/poison)、buff/debuff 倒计时
    // ============================================================
    tickDebuffs(unit, gameState) {
        if (!unit.debuffs || unit.debuffs.length === 0) return [];
        const logs = [];
        const remain = [];
        unit.debuffs.forEach(d => {
            // 每回合结算效果
            if (d.type === 'poison' && !unit.dead) {
                const dmg = d.amount || d.damage || 10;
                unit.hp = Math.max(0, unit.hp - dmg);
                if (unit.hp <= 0) unit.dead = true;
                logs.push({ unit: unit.name, type: 'poison', amount: dmg });
            }
            if (d.type === 'burn' && !unit.dead) {
                const dmg = d.amount || d.damage || 15;
                unit.hp = Math.max(0, unit.hp - dmg);
                if (unit.hp <= 0) unit.dead = true;
                logs.push({ unit: unit.name, type: 'burn', amount: dmg });
            }
            if (d.type === 'stun') {
                unit.stunned = Math.max(0, (unit.stunned || 0) - 1);
                if (unit.stunned === 0) logs.push({ unit: unit.name, type: 'stun_end' });
            }
            if (d.type === 'silence') {
                unit.silenced = Math.max(0, (unit.silenced || 0) - 1);
                if (unit.silenced === 0) logs.push({ unit: unit.name, type: 'silence_end' });
            }
            if (d.type === 'confuse') {
                unit.confused = Math.max(0, (unit.confused || 0) - 1);
            }
            d.turns = (d.turns || 0) - 1;
            if (d.turns > 0) {
                remain.push(d);
            } else {
                // 到期时恢复
                if (d.type === 'slow' && d.originalMov !== undefined) unit.mov = d.originalMov;
                if (d.type === 'shredDef' && d.originalDef !== undefined) unit.def = d.originalDef;
            }
        });
        unit.debuffs = remain;
        return logs;
    },

    tickBuffs(unit, gameState) {
        if (!unit.buffs || unit.buffs.length === 0) return;
        const remain = [];
        unit.buffs.forEach(b => {
            b.turns = (b.turns || 0) - 1;
            if (b.turns > 0) remain.push(b);
            else if (b.effect === 'modifyStat' && b.stat) {
                unit[b.stat] = (unit[b.stat] || 0) - b.value;
            }
        });
        unit.buffs = remain;
    },

    // ============================================================
    // 效果执行器：给一个 { effectKey, params, targetType, delay } 数组
    // caster 释放者，target 主目标（可能是其他效果选出来的）
    // state.units 是全体单位列表
    // ============================================================
    execute(effectList, caster, target, state) {
        if (!effectList) return [];
        const results = [];
        (Array.isArray(effectList) ? effectList : [effectList]).forEach(ef => {
            const fn = this[ef.effectKey];
            if (!fn) { console.warn('[Effect] 未知效果:', ef.effectKey); return; }
            const applyTargets = this._resolveTargets(ef.targetType || 'target', caster, target, state);
            (applyTargets || []).forEach(t => {
                if (t && (t.dead === undefined || t.dead === false)) {
                    const r = fn.call(this, ef.params || {}, t, caster, state);
                    if (r) { r.effectKey = ef.effectKey; results.push(r); }
                }
            });
        });
        return results;
    },

    _resolveTargets(targetType, caster, target, state) {
        if (targetType === 'self') return [caster];
        if (targetType === 'target') return target ? [target] : [];
        if (targetType === 'caster') return [caster];
        if (targetType === 'allAllies') return state.units.filter(u => !u.dead && u.player === caster.player);
        if (targetType === 'allEnemies') return state.units.filter(u => !u.dead && u.player !== caster.player);
        if (targetType === 'allUnits') return state.units.filter(u => !u.dead);
        if (targetType && targetType.startsWith('aoe:') && target) {
            const rangeStr = targetType.substring(4); // e.g. 'r1'
            return this._getAoeTargets(target.x, target.y, rangeStr, state, caster);
        }
        if (targetType && targetType.startsWith('line:') && target) {
            // 'line:5' 朝target方向最多5格穿透
            const len = parseInt(targetType.substring(5)) || 5;
            return this._getLineTargets(caster, target, len, state);
        }
        return target ? [target] : [];
    },

    _getAoeTargets(cx, cy, rangeStr, state, caster) {
        const m = String(rangeStr).match(/^([+xr])(\d+)$/);
        if (!m) return [];
        const kind = m[1], size = parseInt(m[2]);
        const positions = [];
        if (kind === '+') for (let i = 1; i <= size; i++) positions.push({ x: cx + i, y: cy }, { x: cx - i, y: cy }, { x: cx, y: cy + i }, { x: cx, y: cy - i });
        if (kind === 'x') for (let i = 1; i <= size; i++) positions.push({ x: cx + i, y: cy + i }, { x: cx - i, y: cy + i }, { x: cx + i, y: cy - i }, { x: cx - i, y: cy - i });
        if (kind === 'r') {
            for (let dy = -size; dy <= size; dy++) for (let dx = -size; dx <= size; dx++) {
                if (dx === 0 && dy === 0) continue;
                if (Math.abs(dx) + Math.abs(dy) <= size) positions.push({ x: cx + dx, y: cy + dy });
            }
        }
        const BS = window.BOARD_SIZE || 12;
        return state.units.filter(u =>
            !u.dead && u.player !== caster.player &&
            positions.some(p => p.x === u.x && p.y === u.y) &&
            u.x >= 0 && u.x < BS && u.y >= 0 && u.y < BS
        );
    },

    _getLineTargets(caster, target, length, state) {
        const dx = Math.sign(target.x - caster.x);
        const dy = Math.sign(target.y - caster.y);
        const BS = window.BOARD_SIZE || 12;
        const hits = [];
        for (let i = 1; i <= length; i++) {
            const nx = caster.x + dx * i, ny = caster.y + dy * i;
            if (nx < 0 || nx >= BS || ny < 0 || ny >= BS) break;
            const hit = state.units.find(u => u.x === nx && u.y === ny && !u.dead && u.player !== caster.player);
            if (hit) hits.push(hit);
        }
        return hits;
    },

    // ============================================================
    // 被动效果执行（由 game.js 在特定时机触发）
    // 被动配置示例：
    // { trigger: 'onKill', effects: [ { effectKey:'grantExtraAction', targetType:'self' } ] }
    // ============================================================
    runPassive(passiveConfig, unit, state, context) {
        if (!passiveConfig) return [];
        const list = passiveConfig.effects || passiveConfig;
        return this.execute(list, unit, context && context.target, state);
    },

    // ============================================================
    // 条件检查：用于被动效果的条件门
    // ============================================================
    checkCondition(cond, unit, state, context) {
        if (!cond) return true;
        if (cond.if === 'onKill') return !!context.killed;
        if (cond.if === 'lowHp' && unit.maxHp) return unit.hp / unit.maxHp <= (cond.threshold || 0.3);
        if (cond.if === 'enemyNearby') {
            return state.units.some(u => !u.dead && u.player !== unit.player &&
                Math.abs(u.x - unit.x) + Math.abs(u.y - unit.y) <= (cond.distance || 2));
        }
        return true;
    }
};
