// ================================
// 效果系统 - 软编码支持
// ================================

window.Effect = {
    // 解析并执行效果列表
    executeEffects(effects, attacker, target, gameState, extraData = {}) {
        if (!effects || effects.length === 0) {
            return null;
        }
        const results = [];
        for (const effect of effects) {
            const result = this.executeEffect(effect, attacker, target, gameState, extraData);
            if (result) results.push(result);
        }
        return this.mergeResults(results);
    },

    // 执行单个效果
    executeEffect(effect, attacker, target, gameState, extraData = {}) {
        if (!effect || !effect.type) {
            return null;
        }
        switch (effect.type) {
            case 'damage':
                return this.damage(attacker, target, effect.damage, effect, gameState);
            case 'heal':
                return this.heal(attacker, target, effect.amount, effect, gameState);
            case 'buff':
                return this.buff(attacker, target, effect, gameState);
            case 'debuff':
                return this.debuff(attacker, target, effect, gameState);
            case 'summon':
                return this.summon(attacker, extraData.x || target.x, extraData.y || target.y, effect.unit, gameState);
            case 'aoe':
                return this.aoe(attacker, target, effect, gameState);
            case 'pierce':
                return this.pierce(attacker, effect, gameState);
            case 'multishot':
                return this.multishot(attacker, target, effect, gameState);
            case 'cone':
                return this.cone(attacker, effect, gameState);
            case 'move':
                return this.move(attacker, extraData.x, extraData.y);
            case 'passive':
                return this.applyPassive(attacker, effect);
            default:
                return null;
        }
    },

    // 合并多个结果
    mergeResults(results) {
        if (!results || results.length === 0) return null;
        if (results.length === 1) return results[0];

        const merged = { type: 'combined' };
        for (const r of results) {
            if (r.damage) merged.damage = (merged.damage || 0) + r.damage;
            if (r.heal) merged.heal = (merged.heal || 0) + r.heal;
            if (r.counter) merged.counter = (merged.counter || 0) + r.counter;
            if (r.targets) merged.targets = [...(merged.targets || []), ...(r.targets || [])];
        }
        return merged;
    },

    // 伤害效果
    damage(attacker, target, baseDamage, effectConfig = {}, gameState) {
        if (!target) return { damage: 0, type: 'damage' };
        
        let damage = baseDamage || 0;

        if (effectConfig.terrainBonus && gameState && gameState.TERRAIN) {
            const terrainId = gameState.TERRAIN[target.y]?.[target.x];
            if (terrainId === effectConfig.terrainBonus.terrain) {
                damage *= effectConfig.terrainBonus.multiplier || 1;
            }
        }

        if (effectConfig.conditionBonus && target.debuffs) {
            if (effectConfig.conditionBonus.debuff === 'burn') {
                const hasBurn = target.debuffs.find(d => d.type === 'burn');
                if (hasBurn) {
                    damage *= effectConfig.conditionBonus.multiplier || 1;
                }
            }
        }

        if (effectConfig.hpPercentBonus) {
            const missingHp = 1 - (attacker.hp / attacker.maxHp);
            damage += Math.floor(missingHp * effectConfig.hpPercentBonus);
        }

        const def = target.def || 0;
        damage = Math.max(1, Math.floor(damage - def * 0.3));
        target.hp = target.hp - damage;

        if (target.hp <= 0) {
            target.hp = 0;
            target.dead = true;
        }

        let counter = null;
        if (target.counterRate && !target.dead && Math.random() < target.counterRate) {
            const counterDmg = Math.max(1, Math.floor((target.atk || 0) * 0.5 - (attacker.def || 0) * 0.3));
            attacker.hp = (attacker.hp || 0) - counterDmg;
            if (attacker.hp <= 0) { attacker.hp = 0; attacker.dead = true; }
            counter = counterDmg;
        }

        if (attacker._passive_jianXiong) {
            attacker.hp = Math.min(attacker.maxHp || attacker.hp, attacker.hp + damage);
        }

        return { damage, type: 'damage', counter };
    },

    // 治疗效果
    heal(attacker, target, amount, effectConfig = {}, gameState) {
        let realTarget = target;
        if (effectConfig.targetType === 'ally' && target && target.player !== attacker.player) {
            realTarget = attacker;
        }
        if (!realTarget) return { heal: 0, type: 'heal' };
        
        const healAmount = Math.min(amount, (realTarget.maxHp || realTarget.hp) - realTarget.hp);
        realTarget.hp += healAmount;
        return { heal: healAmount, type: 'heal' };
    },

    // 增益效果
    buff(attacker, target, effectConfig, gameState) {
        const { stat, value, turns = 3 } = effectConfig;

        if (stat === 'extraMove') {
            target._extraMove = (target._extraMove || 0) + value;
            return { type: 'buff', stat, value, turns };
        }

        if (!target.buffs) target.buffs = [];
        target.buffs.push({ stat, value, turns });
        target[stat] = (target[stat] || 0) + value;
        return { buff: stat, value, turns, type: 'buff' };
    },

    // 减益效果
    debuff(attacker, target, effectConfig, gameState) {
        const { debuffType, ...params } = effectConfig;
        if (!target) return null;

        switch (debuffType) {
            case 'poison':
                return this.poison(attacker, target, params.damage, params.turns);
            case 'stun':
                return this.stun(attacker, target, params.turns);
            case 'slow':
                return this.slow(attacker, target, params.amount, params.turns);
            case 'burn':
                return this.burn(attacker, target, params.damage, params.turns);
            case 'confuse':
                return this.confuse(attacker, target, params.turns);
            case 'shredDef':
                return this.shredDef(attacker, target, params.amount, params.turns);
            case 'silence':
                return this.silence(attacker, target, params.turns);
            default:
                return null;
        }
    },

    // 召唤效果
    summon(attacker, x, y, unitType, gameState) {
        const summonData = (window.SUMMONS || {})[unitType];
        if (!summonData || !gameState || !gameState.units) return null;

        const unit = {
            id: Date.now() + Math.random(),
            name: summonData.name,
            player: attacker.player,
            x, y,
            hp: summonData.hp,
            maxHp: summonData.hp,
            atk: summonData.atk,
            def: summonData.def,
            mov: summonData.mov,
            moveRange: '+' + summonData.mov,
            attackRange: '+1',
            energy: 0,
            skills: [],
            dead: false,
            moved: false,
            attacked: false,
            usedSkill: false,
            isSummon: true
        };
        gameState.units.push(unit);
        return { unit, type: 'summon' };
    },

    // 范围伤害（AOE）
    aoe(attacker, target, effectConfig, gameState) {
        if (!target || !gameState || !gameState.units) return { damage: 0, type: 'aoe' };
        
        const { damage, range = 1 } = effectConfig;
        const targets = gameState.units.filter(u =>
            !u.dead &&
            u.player !== attacker.player &&
            Math.abs(u.x - target.x) + Math.abs(u.y - target.y) <= range
        );

        const details = [];
        let total = 0;
        targets.forEach(enemy => {
            const r = this.damage(attacker, enemy, damage, {}, gameState);
            total += r.damage;
            details.push({ name: enemy.name, ...r });
        });

        return { damage: total, type: 'aoe', targets: details };
    },

    // 穿透伤害
    pierce(attacker, effectConfig, gameState) {
        if (!gameState || !gameState.units) return { damage: 0, type: 'pierce' };
        
        const { damage } = effectConfig;
        const target = gameState._target;
        if (!target) return { damage: 0, type: 'pierce' };
        
        const dx = Math.sign(target.x - attacker.x) || 1;
        const dy = Math.sign(target.y - attacker.y) || 0;
        const boardSize = window.BOARD_SIZE || 12;

        const details = [];
        let total = 0;
        for (let i = 1; i <= boardSize; i++) {
            const tx = attacker.x + dx * i, ty = attacker.y + dy * i;
            if (tx < 0 || tx >= boardSize || ty < 0 || ty >= boardSize) break;
            const hit = gameState.units.find(u => u.x === tx && u.y === ty && !u.dead && u.player !== attacker.player);
            if (hit) {
                const r = this.damage(attacker, hit, damage, {}, gameState);
                total += r.damage;
                details.push({ name: hit.name, ...r });
            }
        }
        return { damage: total, type: 'pierce', targets: details };
    },

    // 多重射击
    multishot(attacker, target, effectConfig, gameState) {
        if (!target) return { damage: 0, type: 'multishot' };
        
        const { times, damagePerShot } = effectConfig;
        const details = [];
        let total = 0;
        for (let i = 0; i < times; i++) {
            if (target.dead) break;
            const r = this.damage(attacker, target, damagePerShot, {}, gameState);
            total += r.damage;
            details.push(r);
        }
        return { damage: total, type: 'multishot', hits: details.length, details };
    },

    // 扇形攻击
    cone(attacker, effectConfig, gameState) {
        if (!gameState || !gameState.units) return { damage: 0, type: 'cone' };
        
        const { damage, range = 2 } = effectConfig;
        const targets = gameState.units.filter(u =>
            !u.dead &&
            u.player !== attacker.player &&
            Math.abs(u.x - attacker.x) <= range &&
            Math.abs(u.y - attacker.y) <= range
        );

        const details = [];
        let total = 0;
        targets.forEach(enemy => {
            const r = this.damage(attacker, enemy, damage, {}, gameState);
            total += r.damage;
            details.push({ name: enemy.name, ...r });
        });
        return { damage: total, type: 'cone', targets: details };
    },

    // 移动效果
    move(unit, x, y) {
        if (unit && x !== undefined && y !== undefined) {
            unit.x = x;
            unit.y = y;
        }
        return { type: 'move', x: unit?.x, y: unit?.y };
    },

    // 应用被动效果
    applyPassive(unit, effectConfig) {
        if (!unit || !effectConfig) return { type: 'passive' };
        
        const { flag, value, stat, modify } = effectConfig;

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

        return { type: 'passive' };
    },

    // 状态效果 - 中毒
    poison(attacker, target, damage = 10, turns = 3) {
        if (!target) return { type: 'poison', damage: 0, turns };
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'poison', damage, turns });
        return { type: 'poison', damage, turns };
    },

    // 状态效果 - 眩晕
    stun(attacker, target, turns = 1) {
        if (!target) return { type: 'stun', turns };
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'stun', turns });
        target.stunned = turns;
        return { type: 'stun', turns };
    },

    // 状态效果 - 减速
    slow(attacker, target, amount = 1, turns = 2) {
        if (!target) return { type: 'slow', amount: 0, turns };
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'slow', amount, turns, originalMov: target.mov });
        target.mov = Math.max(1, target.mov - amount);
        return { type: 'slow', amount, turns };
    },

    // 状态效果 - 破甲
    shredDef(attacker, target, amount = 10, turns = 1) {
        if (!target) return { type: 'shredDef', value: 0, turns };
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'shredDef', value: amount, turns, originalDef: target.def });
        target.def = Math.max(0, target.def - amount);
        return { type: 'shredDef', value: amount, turns };
    },

    // 状态效果 - 燃烧
    burn(attacker, target, damage = 15, turns = 2) {
        if (!target) return { type: 'burn', damage: 0, turns };
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'burn', damage, turns });
        return { type: 'burn', damage, turns };
    },

    // 状态效果 - 混乱
    confuse(attacker, target, turns = 1) {
        if (!target) return { type: 'confuse', turns };
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'confuse', turns });
        target.confused = turns;
        return { type: 'confuse', turns };
    },

    // 状态效果 - 沉默
    silence(attacker, target, turns = 1) {
        if (!target) return { type: 'silence', turns };
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'silence', turns });
        target.silenced = turns;
        return { type: 'silence', turns };
    },

    // 设置反击率
    setCounterRate(target, rate) {
        if (!target) return { type: 'counterRate', rate: 0 };
        target.counterRate = rate;
        return { type: 'counterRate', rate };
    },

    // 设置闪避率
    setDodgeRate(target, rate) {
        if (!target) return { type: 'dodgeRate', rate: 0 };
        target.dodgeRate = rate;
        return { type: 'dodgeRate', rate };
    },

    // 突进伤害
    dashDamage(attacker, target, damage, toX, toY) {
        if (attacker) {
            attacker.x = toX;
            attacker.y = toY;
        }
        return this.damage(attacker, target, damage, {}, null);
    },

    // 立即获得一次额外行动机会
    grantExtraAction(target) {
        if (target) {
            target.moved = false;
            target.attacked = false;
        }
        return { type: 'extraAction' };
    },

    // 选择落点
    selectLanding(target, rangeStr, gameState) {
        if (!target || !gameState || !gameState.units) return { type: 'selectLanding', positions: [] };
        const positions = window.Range ? window.Range.parse(rangeStr, target.x, target.y) : [];
        const validPositions = positions.filter(p => {
            return !gameState.units.find(u => u.x === p.x && u.y === p.y && !u.dead);
        });
        return { type: 'selectLanding', positions: validPositions, target };
    },

    // 移动到指定坐标
    moveTo(unit, x, y) {
        if (unit) {
            unit.x = x;
            unit.y = y;
        }
        return { type: 'moveTo', x, y };
    }
};
