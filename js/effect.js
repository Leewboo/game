// effect.js - 通用效果库（纯函数）
// 所有效果由 window.Effect 暴露
// 单位对象结构：{ id, name, player, x, y, hp, maxHp, atk, def, dead, debuffs, buffs, moved, attacked, usedSkill }

window.Effect = {
    damage(params, target, caster, state) {
        if (!target || target.dead) return { applied: false };
        const amount = params.amount || 10;
        const reduce = (target.def || 0) * (params.defFactor || 0.3);
        const finalAmount = Math.max(1, Math.floor(amount - reduce));
        target.hp = Math.max(0, target.hp - finalAmount);
        if (target.hp <= 0) target.dead = true;
        return { applied: true, type: 'damage', amount: finalAmount, targetId: target.id };
    },

    heal(params, target, caster, state) {
        if (!target || target.dead) return { applied: false };
        const amount = params.amount || 10;
        const maxHp = target.maxHp || target.hp + amount;
        const before = target.hp;
        target.hp = Math.min(maxHp, target.hp + amount);
        return { applied: true, type: 'heal', amount: target.hp - before, targetId: target.id };
    },

    modifyStat(params, target, caster, state) {
        if (!target) return { applied: false };
        const stat = params.stat;
        const value = params.value || 0;
        target[stat] = (target[stat] || 0) + value;
        return { applied: true, type: 'modifyStat', stat, value, targetId: target.id };
    },

    markStatus(params, target, caster, state) {
        if (!target || target.dead) return { applied: false };
        const status = params.status;
        const turns = params.turns || 1;
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: status, turns, value: params.value, amount: params.amount });
        if (status === 'stun') target.stunned = Math.max(target.stunned || 0, turns);
        if (status === 'silence') target.silenced = Math.max(target.silenced || 0, turns);
        if (status === 'slow') { target.mov = Math.max(1, target.mov - (params.amount || 1)); }
        if (status === 'shredDef') { target.def = Math.max(0, target.def - (params.amount || 10)); }
        return { applied: true, type: 'markStatus', status, turns, targetId: target.id };
    },

    markFlag(params, target, caster, state) {
        if (!target) return { applied: false };
        target[params.flag] = params.value !== undefined ? params.value : true;
        return { applied: true, type: 'markFlag', flag: params.flag, value: params.value, targetId: target.id };
    },

    grantExtraAction(params, target, caster, state) {
        if (!target) return { applied: false };
        target.moved = false;
        target.attacked = false;
        return { applied: true, type: 'grantExtraAction', targetId: target.id };
    },

    tickDebuffs(unit, gameState) {
        if (!unit.debuffs || unit.debuffs.length === 0) return;
        const remain = [];
        unit.debuffs.forEach(d => {
            if (d.type === 'burn' && !unit.dead) {
                const dmg = d.amount || d.damage || 10;
                unit.hp = Math.max(0, unit.hp - dmg);
                if (unit.hp <= 0) unit.dead = true;
            }
            if (d.type === 'poison' && !unit.dead) {
                const dmg = d.amount || d.damage || 10;
                unit.hp = Math.max(0, unit.hp - dmg);
                if (unit.hp <= 0) unit.dead = true;
            }
            if (d.type === 'stun') unit.stunned = Math.max(0, (unit.stunned || 1) - 1);
            if (d.type === 'silence') unit.silenced = Math.max(0, (unit.silenced || 1) - 1);
            d.turns = (d.turns || 0) - 1;
            if (d.turns > 0) remain.push(d);
        });
        unit.debuffs = remain;
    },

    execute(effectList, caster, target, state) {
        if (!effectList) return [];
        const results = [];
        const list = Array.isArray(effectList) ? effectList : [effectList];
        list.forEach(ef => {
            const fn = this[ef.effectKey];
            if (!fn) return;
            const applyTargets = this._resolveTargets(ef.targetType || 'target', caster, target, state);
            (applyTargets || []).forEach(t => {
                if (!t || t.dead === true) return;
                const r = fn.call(this, ef.params || {}, t, caster, state);
                if (r) { r.effectKey = ef.effectKey; results.push(r); }
            });
        });
        return results;
    },

    _resolveTargets(targetType, caster, target, state) {
        if (targetType === 'self' || targetType === 'caster') return [caster];
        if (targetType === 'target') return target ? [target] : [];
        if (targetType === 'allAllies') return state.units.filter(u => !u.dead && u.player === caster.player);
        if (targetType === 'allEnemies') return state.units.filter(u => !u.dead && u.player !== caster.player);
        if (targetType === 'allUnits') return state.units.filter(u => !u.dead);
        if (target && targetType && targetType.startsWith('aoe:') && target) {
            const r = parseInt(targetType.substring(4), 10) || 1;
            return state.units.filter(u => !u.dead && u.player !== caster.player
                && Math.abs(u.x - target.x) + Math.abs(u.y - target.y) <= r);
        }
        return target ? [target] : [];
    }
};
