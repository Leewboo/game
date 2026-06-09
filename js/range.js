// range.js - 范围解析工具（纯函数）
// 支持 rangeStr 格式：
//   "+N"  : 十字扩散 N 格（曼哈顿距离 ≤ N，用于移动）
//   "rN"  : 以目标为中心的 N 格半径（曼哈顿距离 ≤ N，用于技能AOE/攻击范围）
//   "xN"  : 对角线 N 格
//   "crossN" / "cN" : 十字 N 格（上下左右各 N 格）
// 注意：terrain 中 0=草地(通行) 1=山(阻挡) 2=河(阻挡) 3=城(通行) 4=沼(通行) 5=桥(通行)
// BLOCKING_TERRAIN_MOVE = {1, 2} （阻挡移动）
// BLOCKING_TERRAIN_ATTACK = {1} （阻挡攻击视线）

window.Range = {
    parse(rangeStr, x, y, blockingSet, terrain) {
        return this._computeCells(rangeStr, x, y, blockingSet, terrain, false);
    },

    parseBlocked(rangeStr, x, y, occupiedSet, blockingSet, terrain) {
        // 与 parse 类似，但额外排除被占据的格子（用于移动，目标不能站人）
        return this._computeCells(rangeStr, x, y, blockingSet, terrain, false, occupiedSet);
    },

    _computeCells(rangeStr, x, y, blockingSet, terrain, bfsMode, occupiedSet) {
        const s = String(rangeStr || '').trim().toLowerCase();
        const BS = window.BOARD_SIZE || 12;
        const m = s.match(/^([+xr]|cross|c)(\d+)$/);
        if (!m) return [{ x, y }];

        const kind = m[1];
        const size = parseInt(m[2], 10);
        const cells = [];

        if (kind === '+') {
            for (let dy = -size; dy <= size; dy++) {
                for (let dx = -size; dx <= size; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (Math.abs(dx) + Math.abs(dy) > size) continue;
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= BS || ny < 0 || ny >= BS) continue;
                    if (blockingSet && terrain && terrain[ny] && blockingSet.has(terrain[ny][nx])) continue;
                    if (occupiedSet && occupiedSet.has(nx + ',' + ny)) continue;
                    cells.push({ x: nx, y: ny });
                }
            }
        } else if (kind === 'r') {
            for (let dy = -size; dy <= size; dy++) {
                for (let dx = -size; dx <= size; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (Math.abs(dx) + Math.abs(dy) > size) continue;
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= BS || ny < 0 || ny >= BS) continue;
                    cells.push({ x: nx, y: ny });
                }
            }
        } else if (kind === 'x') {
            for (let i = 1; i <= size; i++) {
                [[x + i, y + i], [x - i, y + i], [x + i, y - i], [x - i, y - i]].forEach(([nx, ny]) => {
                    if (nx < 0 || nx >= BS || ny < 0 || ny >= BS) return;
                    if (blockingSet && terrain && terrain[ny] && blockingSet.has(terrain[ny][nx])) return;
                    cells.push({ x: nx, y: ny });
                });
            }
        } else if (kind === 'cross' || kind === 'c') {
            for (let i = 1; i <= size; i++) {
                [[x + i, y], [x - i, y], [x, y + i], [x, y - i]].forEach(([nx, ny]) => {
                    if (nx < 0 || nx >= BS || ny < 0 || ny >= BS) return;
                    if (blockingSet && terrain && terrain[ny] && blockingSet.has(terrain[ny][nx])) return;
                    cells.push({ x: nx, y: ny });
                });
            }
        }
        return cells;
    },

    // 计算从起点到目标是否可达（简单曼哈顿距离内，且无阻挡）
    reachableInRange(rangeStr, fromX, fromY, toX, toY, blockingSet, terrain) {
        const cells = this.parse(rangeStr, fromX, fromY, blockingSet, terrain);
        return cells.some(c => c.x === toX && c.y === toY);
    }
};
