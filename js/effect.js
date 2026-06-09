// ================================
// 效果系统 - 软编码支持
// ================================

const Effect = {
    // 解析并执行效果列表
    executeEffects(effects, attacker, target, gameState, extraData = {}) {
        const results = [];
        for (const effect of effects) {
            const result = this.executeEffect(effect, attacker, target, gameState, extraData);
            if (result) results.push(result);
        }
        return this.mergeResults(results);
    },

    // 执行单个效果
    executeEffect(effect, attacker, target, gameState, extraData = {}) {
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
                console.warn('[Effect] Unknown effect type:', effect.type);
                return null;
        }
    },

    // 合并多个结果
    mergeResults(results) {
        if (results.length === 0) return null;
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
        let damage = baseDamage;

        // 地形加成
        if (effectConfig.terrainBonus) {
            const terrainId = gameState.TERRAIN?.[target.y]?.[target.x];
            if (terrainId === effectConfig.terrainBonus.terrain) {
                damage *= effectConfig.terrainBonus.multiplier;
                if (!gameState._terrainBonus) gameState._terrainBonus = true;
            }
        }

        // 条件加成（如目标有燃烧效果）
        if (effectConfig.conditionBonus) {
            if (effectConfig.conditionBonus.debuff === 'burn' && target.debuffs) {
                const hasBurn = target.debuffs.find(d => d.type === 'burn');
                if (hasBurn) {
                    damage *= effectConfig.conditionBonus.multiplier;
                }
            }
        }

        // 生命值百分比加成
        if (effectConfig.hpPercentBonus) {
            const missingHp = 1 - (attacker.hp / attacker.maxHp);
            damage += Math.floor(missingHp * effectConfig.hpPercentBonus);
        }

        // 被动效果：奸雄
        if (attacker._passive_jianXiong) {
            // 先记录伤害前的生命值
        }

        damage = Math.max(1, Math.floor(damage - target.def * 0.3));
        target.hp -= damage;

        if (target.hp <= 0) {
            target.hp = 0;
            target.dead = true;
        }

        let counter = null;
        if (target.counterRate && !target.dead && Math.random() < target.counterRate) {
            const counterDmg = Math.max(1, Math.floor(target.atk * 0.5 - attacker.def * 0.3));
            attacker.hp -= counterDmg;
            if (attacker.hp <= 0) { attacker.hp = 0; attacker.dead = true; }
            counter = counterDmg;
        }

        // 被动效果：奸雄 - 回复伤害量的生命
        if (attacker._passive_jianXiong) {
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + damage);
        }

        return { damage, type: 'damage', counter };
    },

    // 治疗效果
    heal(attacker, target, amount, effectConfig = {}, gameState) {
        // 如果配置了目标类型，可能需要找到正确的目标
        let realTarget = target;
        if (effectConfig.targetType === 'ally') {
            // 友方治疗可能是自己
            if (target.player !== attacker.player) {
                realTarget = attacker; // 治疗自己
            }
        }

        const healAmount = Math.min(amount, realTarget.maxHp - realTarget.hp);
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

        if (!target.debuffs) target.debuffs = [];

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
        const summonData = window.SUMMONS?.[unitType];
        if (!summonData) {
            console.warn('[Effect] Unknown summon unit:', unitType);
            return null;
        }

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
        const { damage } = effectConfig;
        const dx = Math.sign(gameState._target?.x - attacker.x) || 1;
        const dy = Math.sign(gameState._target?.y - attacker.y) || 0;

        const details = [];
        let total = 0;
        for (let i = 1; i <= 12; i++) {
            const tx = attacker.x + dx * i, ty = attacker.y + dy * i;
            if (tx < 0 || tx >= window.BOARD_SIZE || ty < 0 || ty >= window.BOARD_SIZE) break;
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
        const { times, damagePerShot } = effectConfig;
        const details = [];
        let total = 0;
        for (let i = 0; i < times; i++) {
            const r = this.damage(attacker, target, damagePerShot, {}, gameState);
            total += r.damage;
            details.push(r);
            if (target.dead) break;
        }
        return { damage: total, type: 'multishot', hits: details.length, details };
    },

    // 扇形攻击
    cone(attacker, effectConfig, gameState) {
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
        if (x !== undefined && y !== undefined) {
            unit.x = x;
            unit.y = y;
        }
        return { type: 'move', x: unit.x, y: unit.y };
    },

    // 应用被动效果
    applyPassive(unit, effectConfig) {
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
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'poison', damage, turns });
        return { type: 'poison', damage, turns };
    },

    // 状态效果 - 眩晕
    stun(attacker, target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'stun', turns });
        target.stunned = turns;
        return { type: 'stun', turns };
    },

    // 状态效果 - 减速
    slow(attacker, target, amount = 1, turns = 2) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'slow', amount, turns, originalMov: target.mov });
        target.mov = Math.max(1, target.mov - amount);
        return { type: 'slow', amount, turns };
    },

    // 状态效果 - 破甲
    shredDef(attacker, target, amount = 10, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'shredDef', value: amount, turns, originalDef: target.def });
        target.def = Math.max(0, target.def - amount);
        return { type: 'shredDef', value: amount, turns };
    },

    // 状态效果 - 燃烧
    burn(attacker, target, damage = 15, turns = 2) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'burn', damage, turns });
        return { type: 'burn', damage, turns };
    },

    // 状态效果 - 混乱
    confuse(attacker, target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'confuse', turns });
        target.confused = turns;
        return { type: 'confuse', turns };
    },

    // 状态效果 - 沉默
    silence(attacker, target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'silence', turns });
        target.silenced = turns;
        return { type: 'silence', turns };
    },

    // 设置反击率
    setCounterRate(target, rate) {
        target.counterRate = rate;
        return { type: 'counterRate', rate };
    },

    // 设置闪避率
    setDodgeRate(target, rate) {
        target.dodgeRate = rate;
        return { type: 'dodgeRate', rate };
    },

    // 突进伤害：先位移到指定位置，再对目标造成伤害
    dashDamage(attacker, target, damage, toX, toY) {
        attacker.x = toX;
        attacker.y = toY;
        return this.damage(attacker, target, damage, {}, null);
    },

    // 立即获得一次额外行动机会
    grantExtraAction(target) {
        target.moved = false;
        target.attacked = false;
        return { type: 'extraAction' };
    },

    // 选择落点：返回目标周围指定范围内的空格列表
    selectLanding(target, rangeStr, gameState) {
        const { Range } = gameState._modules || {};
        if (!Range) return { type: 'selectLanding', positions: [] };
        const positions = Range.parse(rangeStr, target.x, target.y).filter(p => {
            return !gameState.units.find(u => u.x === p.x && u.y === p.y && !u.dead);
        });
        return { type: 'selectLanding', positions, target };
    },

    // 移动到指定坐标
    moveTo(unit, x, y) {
        unit.x = x;
        unit.y = y;
        return { type: 'moveTo', x, y };
    }
};

window.Effect = Effect;
