// ================================
// 效果系统
// ================================

window.Effect = {
    damage(attacker, target, baseDamage, terrainBonus = null) {
        if (terrainBonus && terrainBonus.terrain === window.TERRAIN[target.y]?.[target.x]) {
            baseDamage *= terrainBonus.multiplier;
        }
        const damage = Math.max(1, Math.floor(baseDamage - target.def * 0.3));
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
        return { damage, type: 'damage', counter };
    },

    heal(target, amount) {
        const heal = Math.min(amount, target.maxHp - target.hp);
        target.hp += heal;
        return { heal, type: 'heal' };
    },

    aoe(attacker, targetList, damage, gameState) {
        const details = [];
        let total = 0;
        targetList.forEach(enemy => {
            if (!enemy.dead) {
                const r = this.damage(attacker, enemy, damage);
                total += r.damage;
                details.push({ name: enemy.name, ...r });
            }
        });
        return { damage: total, type: 'aoe', targets: details };
    },

    pierce(attacker, targetX, targetY, damage, gameState) {
        const dx = Math.sign(targetX - attacker.x) || 1;
        const dy = Math.sign(targetY - attacker.y) || 0;
        const details = [];
        let total = 0;
        for (let i = 1; i <= window.BOARD_SIZE; i++) {
            const tx = attacker.x + dx * i;
            const ty = attacker.y + dy * i;
            if (tx < 0 || tx >= window.BOARD_SIZE || ty < 0 || ty >= window.BOARD_SIZE) break;
            const hit = gameState.units.find(u => u.x === tx && u.y === ty && !u.dead && u.player !== attacker.player);
            if (hit) {
                const r = this.damage(attacker, hit, damage);
                total += r.damage;
                details.push({ name: hit.name, ...r });
            }
        }
        return { damage: total, type: 'pierce', targets: details };
    },

    summon(attacker, x, y, unitType, gameState) {
        const summonData = window.SUMMONS[unitType];
        if (!summonData) return null;
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

    move(unit, x, y) {
        unit.x = x;
        unit.y = y;
        return { type: 'move', x, y };
    },

    poison(target, damage = 10, turns = 3) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'poison', damage, turns });
        return { type: 'poison', damage, turns };
    },

    stun(target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'stun', turns });
        target.stunned = turns;
        return { type: 'stun', turns };
    },

    slow(target, amount = 1, turns = 2) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'slow', amount, turns, originalMov: target.mov });
        target.mov = Math.max(1, target.mov - amount);
        return { type: 'slow', amount, turns };
    },

    burn(target, damage = 15, turns = 2) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'burn', damage, turns });
        return { type: 'burn', damage, turns };
    },

    confuse(target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'confuse', turns });
        target.confused = turns;
        return { type: 'confuse', turns };
    },

    silence(target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'silence', turns });
        target.silenced = turns;
        return { type: 'silence', turns };
    },

    shredDef(target, amount = 10, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'shredDef', value: amount, turns, originalDef: target.def });
        target.def = Math.max(0, target.def - amount);
        return { type: 'shredDef', value: amount, turns };
    },

    grantExtraAction(target) {
        target.moved = false;
        target.attacked = false;
        return { type: 'extraAction' };
    },

    applyPassiveFlags(unit, passiveEffects) {
        passiveEffects.forEach(effect => {
            if (effect.flag) unit[effect.flag] = effect.value;
            if (effect.stat && typeof effect.modify === 'number') {
                unit[effect.stat] = (unit[effect.stat] || 0) + effect.modify;
            }
            if (effect.stat === 'attackRange' && typeof effect.modify === 'string' && effect.modify.startsWith('+')) {
                const add = parseInt(effect.modify.substring(1));
                const current = unit.attackRange || '+1';
                const match = current.match(/^([+xr])(\d+)$/);
                if (match) {
                    const type = match[1];
                    const num = parseInt(match[2]) + add;
                    unit.attackRange = type + num;
                }
            }
        });
    }
};
