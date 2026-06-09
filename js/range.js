// ================================
// 范围系统
// ================================
const BOARD_SIZE = 12;
window.BOARD_SIZE = BOARD_SIZE;

// 地形阻断辅助: 检查某坐标是否被指定地形集合阻断
function isTerrainBlocked(x, y, terrainSet, terrainMap) {
    if (!terrainSet || !terrainMap) return false;
    const tid = terrainMap[y] && terrainMap[y][x];
    return terrainSet.has(tid);
}

const Range = {
    plusBlocked(n, x, y, blockedSet, terrainBlockSet, terrainMap) {
        const result = [];
        const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
        for (const dir of dirs) {
            for (let i = 1; i <= n; i++) {
                const px = x + dir.dx * i;
                const py = y + dir.dy * i;
                if (px < 0 || px >= BOARD_SIZE || py < 0 || py >= BOARD_SIZE) break;
                result.push({ x: px, y: py });
                if (blockedSet.has(`${px},${py}`)) break;
                if (isTerrainBlocked(px, py, terrainBlockSet, terrainMap)) break;
            }
        }
        return result;
    },
    xBlocked(n, x, y, blockedSet, terrainBlockSet, terrainMap) {
        const result = [];
        const dirs = [{dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1}];
        for (const dir of dirs) {
            for (let i = 1; i <= n; i++) {
                const px = x + dir.dx * i;
                const py = y + dir.dy * i;
                if (px < 0 || px >= BOARD_SIZE || py < 0 || py >= BOARD_SIZE) break;
                result.push({ x: px, y: py });
                if (blockedSet.has(`${px},${py}`)) break;
                if (isTerrainBlocked(px, py, terrainBlockSet, terrainMap)) break;
            }
        }
        return result;
    },
    rBlocked(n, x, y, blockedSet, terrainBlockSet, terrainMap) {
        const result = [];
        const visited = new Set();
        visited.add(`${x},${y}`);
        let frontier = [{x, y, d:0}];
        while (frontier.length > 0) {
            const next = [];
            for (const cur of frontier) {
                if (cur.d >= n) continue;
                const neighs = [
                    {x: cur.x+1, y: cur.y}, {x: cur.x-1, y: cur.y},
                    {x: cur.x, y: cur.y+1}, {x: cur.x, y: cur.y-1}
                ];
                for (const nb of neighs) {
                    const key = `${nb.x},${nb.y}`;
                    if (nb.x < 0 || nb.x >= BOARD_SIZE || nb.y < 0 || nb.y >= BOARD_SIZE) continue;
                    if (visited.has(key)) continue;
                    visited.add(key);
                    result.push({ x: nb.x, y: nb.y });
                    if (blockedSet.has(key)) continue;
                    if (isTerrainBlocked(nb.x, nb.y, terrainBlockSet, terrainMap)) continue;
                    next.push({x: nb.x, y: nb.y, d: cur.d + 1});
                }
            }
            frontier = next;
        }
        return result.filter(p => !(p.x === x && p.y === y));
    },
    plus(n, x, y, terrainBlockSet, terrainMap) {
        const result = [];
        for (let i = 1; i <= n; i++) {
            result.push({ x: x + i, y });
            result.push({ x: x - i, y });
            result.push({ x, y: y + i });
            result.push({ x, y: y - i });
        }
        return result.filter(p => {
            if (p.x < 0 || p.x >= BOARD_SIZE || p.y < 0 || p.y >= BOARD_SIZE) return false;
            return !isTerrainBlocked(p.x, p.y, terrainBlockSet, terrainMap);
        });
    },
    x(n, x, y, terrainBlockSet, terrainMap) {
        const result = [];
        for (let i = 1; i <= n; i++) {
            result.push({ x: x + i, y: y + i });
            result.push({ x: x - i, y: y + i });
            result.push({ x: x + i, y: y - i });
            result.push({ x: x - i, y: y - i });
        }
        return result.filter(p => {
            if (p.x < 0 || p.x >= BOARD_SIZE || p.y < 0 || p.y >= BOARD_SIZE) return false;
            return !isTerrainBlocked(p.x, p.y, terrainBlockSet, terrainMap);
        });
    },
    r(n, x, y, terrainBlockSet, terrainMap) {
        const result = [];
        for (let dy = -n; dy <= n; dy++) {
            for (let dx = -n; dx <= n; dx++) {
                if (dx === 0 && dy === 0) continue;
                if (Math.abs(dx) + Math.abs(dy) <= n) {
                    result.push({ x: x + dx, y: y + dy });
                }
            }
        }
        return result.filter(p => {
            if (p.x < 0 || p.x >= BOARD_SIZE || p.y < 0 || p.y >= BOARD_SIZE) return false;
            return !isTerrainBlocked(p.x, p.y, terrainBlockSet, terrainMap);
        });
    },
    parseBlocked(rangeInput, x, y, blockedSet, terrainBlockSet, terrainMap) {
        const ranges = Array.isArray(rangeInput) ? rangeInput : [rangeInput];
        const result = [];
        const seen = new Set();
        for (const rangeStr of ranges) {
            const match = String(rangeStr).match(/^([+xr])(\d+)$/);
            if (!match) continue;
            const type = match[1];
            const n = parseInt(match[2]);
            let pts = [];
            if (type === '+') pts = this.plusBlocked(n, x, y, blockedSet, terrainBlockSet, terrainMap);
            else if (type === 'x') pts = this.xBlocked(n, x, y, blockedSet, terrainBlockSet, terrainMap);
            else if (type === 'r') pts = this.rBlocked(n, x, y, blockedSet, terrainBlockSet, terrainMap);
            for (const p of pts) {
                const key = `${p.x},${p.y}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(p);
                }
            }
        }
        return result;
    },
    parse(rangeInput, x, y, terrainBlockSet, terrainMap) {
        const ranges = Array.isArray(rangeInput) ? rangeInput : [rangeInput];
        const result = [];
        const seen = new Set();
        for (const rangeStr of ranges) {
            const match = String(rangeStr).match(/^([+xr])(\d+)$/);
            if (!match) continue;
            const type = match[1];
            const n = parseInt(match[2]);
            let pts = [];
            if (type === '+') pts = this.plus(n, x, y, terrainBlockSet, terrainMap);
            else if (type === 'x') pts = this.x(n, x, y, terrainBlockSet, terrainMap);
            else if (type === 'r') pts = this.r(n, x, y, terrainBlockSet, terrainMap);
            for (const p of pts) {
                const key = `${p.x},${p.y}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(p);
                }
            }
        }
        return result;
    }
};

window.Range = Range;
