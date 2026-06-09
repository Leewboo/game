// ================================
// 效果系统
// ================================
const Effect = {
    damage(attacker, target, damage) {
        if (target.dodgeRate && Math.random() < target.dodgeRate) {
            return { damage: 0, type: 'dodge' };
        }
        const realDamage = Math.max(1, Math.floor(damage - target.def * 0.3));
        target.hp -= realDamage;
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
        return { damage: realDamage, type: 'damage', counter };
    },
    heal(healer, target, amount) {
        const healAmount = Math.min(amount, target.maxHp - target.hp);
        target.hp += healAmount;
        return { heal: healAmount, type: 'heal' };
    },
    buffAtk(user, target, amount, turns = 3) {
        if (!target.buffs) target.buffs = [];
        target.buffs.push({ stat: 'atk', value: amount, turns });
        target.atk += amount;
        return { buff: 'atk', value: amount, turns, type: 'buff' };
    },
    buffDef(user, target, amount, turns = 3) {
        if (!target.buffs) target.buffs = [];
        target.buffs.push({ stat: 'def', value: amount, turns });
        target.def += amount;
        return { buff: 'def', value: amount, turns, type: 'buff' };
    },
    summon(summoner, summonData, x, y, gameState) {
        const unit = {
            id: Date.now() + Math.random(),
            name: summonData.name,
            player: summoner.player,
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
    aoeDamage(attacker, target, damage, range, gameState) {
        const targets = gameState.units.filter(u => !u.dead && u.player !== attacker.player &&
            Math.abs(u.x - target.x) + Math.abs(u.y - target.y) <= range);
        let total = 0;
        const details = [];
        targets.forEach(enemy => {
            const r = this.damage(attacker, enemy, damage);
            total += r.damage;
            details.push({ name: enemy.name, ...r });
        });
        return { damage: total, type: 'aoe', targets: details };
    },
    pierceDamage(attacker, target, damage, gameState) {
        const dx = Math.sign(target.x - attacker.x);
        const dy = Math.sign(target.y - attacker.y);
        let total = 0;
        const details = [];
        for (let i = 1; i <= 12; i++) {
            const tx = attacker.x + dx * i, ty = attacker.y + dy * i;
            if (tx < 0 || tx >= 12 || ty < 0 || ty >= 12) break;
            const hit = gameState.units.find(u => u.x === tx && u.y === ty && !u.dead && u.player !== attacker.player);
            if (hit) {
                const r = this.damage(attacker, hit, damage);
                total += r.damage;
                details.push({ name: hit.name, ...r });
            }
        }
        return { damage: total, type: 'pierce', targets: details };
    },
    poison(attacker, target, damage, turns = 3) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'poison', damage, turns });
        return { type: 'poison', damage, turns };
    },
    stun(attacker, target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'stun', turns });
        target.stunned = turns;
        return { type: 'stun', turns };
    },
    slow(attacker, target, amount, turns = 2) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'slow', amount, turns, originalMov: target.mov });
        target.mov = Math.max(1, target.mov - amount);
        return { type: 'slow', amount, turns };
    },
    setCounterRate(target, rate) {
        target.counterRate = rate;
        return { type: 'counterRate', rate };
    },
    setDodgeRate(target, rate) {
        target.dodgeRate = rate;
        return { type: 'dodgeRate', rate };
    },
    shredDef(attacker, target, amount, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'shredDef', value: amount, turns, originalDef: target.def });
        target.def = Math.max(0, target.def - amount);
        return { type: 'shredDef', value: amount, turns };
    },
    burn(attacker, target, damage, turns = 2) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'burn', damage, turns });
        return { type: 'burn', damage, turns };
    },
    confuse(attacker, target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'confuse', turns });
        target.confused = turns;
        return { type: 'confuse', turns };
    },
    silence(attacker, target, turns = 1) {
        if (!target.debuffs) target.debuffs = [];
        target.debuffs.push({ type: 'silence', turns });
        target.silenced = turns;
        return { type: 'silence', turns };
    },
    lungeDamage(attacker, target, damage, fromX, fromY) {
        const r = this.damage(attacker, target, damage);
        return { ...r, type: 'lunge', fromX, fromY };
    },
    executeDamage(attacker, target, damage) {
        const r = this.damage(attacker, target, damage);
        return { ...r, type: 'execute', extraTurn: target.dead };
    },
    snipeDamage(attacker, target, baseDamage) {
        const missingHpRate = 1 - (target.hp / target.maxHp);
        const bonus = Math.floor(missingHpRate * 5) * 5;
        const total = baseDamage + bonus;
        return this.damage(attacker, target, total);
    },
    desperateDamage(attacker, target, baseDamage) {
        const missingHpRate = 1 - (attacker.hp / attacker.maxHp);
        const bonus = Math.floor(missingHpRate * 4) * 5;
        const total = baseDamage + bonus;
        return this.damage(attacker, target, total);
    },
    multiShot(attacker, target, times, damagePerShot) {
        const details = [];
        let total = 0;
        for (let i = 0; i < times; i++) {
            const r = this.damage(attacker, target, damagePerShot);
            total += r.damage;
            details.push(r);
            if (target.dead) break;
        }
        return { damage: total, type: 'multishot', hits: details.length, details };
    },
    // 立即获得一次额外行动机会（移动+攻击）
    grantExtraAction(target) {
        target.moved = false;
        target.attacked = false;
        return { type: 'extraAction' };
    },
    // 突进伤害：先位移到指定位置，再对目标造成伤害
    dashDamage(attacker, target, damage, toX, toY) {
        attacker.x = toX;
        attacker.y = toY;
        const r = this.damage(attacker, target, damage);
        return { ...r, type: 'dash' };
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
