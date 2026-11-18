// Unit check for non-trivial logic
const assert = require("assert");

// 1. Character classes & weapon integrity check
const CHARACTER_CLASSES = {
    striker: { weaponType: "saber", maxHp: 100 },
    titan: { weaponType: "greatsword", maxHp: 130 },
    shadow: { weaponType: "daggers", maxHp: 85 },
    mage: { weaponType: "staff", maxHp: 80 },
    wrestler: { weaponType: "gauntlets", maxHp: 150 },
    assassin: { weaponType: "claws", maxHp: 70 }
};

assert.strictEqual(Object.keys(CHARACTER_CLASSES).length, 6, "Must have 6 playable classes");
assert.strictEqual(CHARACTER_CLASSES.mage.weaponType, "staff", "Mage must use staff");
assert.strictEqual(CHARACTER_CLASSES.wrestler.weaponType, "gauntlets", "Wrestler must use gauntlets");
assert.strictEqual(CHARACTER_CLASSES.assassin.weaponType, "claws", "Assassin must use claws");

// 2. Best of 3 Match Logic check
function isMatchWon(pWins, eWins) {
    return pWins >= 2 || eWins >= 2;
}
assert.strictEqual(isMatchWon(0, 0), false);
assert.strictEqual(isMatchWon(1, 0), false);
assert.strictEqual(isMatchWon(1, 1), false);
assert.strictEqual(isMatchWon(2, 0), true);
assert.strictEqual(isMatchWon(1, 2), true);

// 3. Guard Crush Threshold check
function checkGuardCrush(holdFrames) {
    return holdFrames >= 180;
}
assert.strictEqual(checkGuardCrush(179), false);
assert.strictEqual(checkGuardCrush(180), true);

// 4. Dash calculation
function calcDashVelocity(key, baseSpeed) {
    const dir = (key === 'a' || key === 'arrowleft') ? -1 : 1;
    return dir * baseSpeed * 2.3;
}
assert.strictEqual(calcDashVelocity('a', 5), -11.5);
assert.strictEqual(calcDashVelocity('d', 5), 11.5);

// 5. Physics check: Asymmetric gravity & terminal velocity
const gravity = 0.95;
const fallGravity = 1.30 * gravity;
const terminalVelocity = -16;
assert(fallGravity > gravity, "Falling gravity must be heavier than rising gravity");

function getNextVy(vy) {
    const g = vy < 0 ? fallGravity : gravity;
    return Math.max(terminalVelocity, vy - g);
}
assert(Math.abs(getNextVy(10) - (10 - 0.95)) < 1e-9);
assert(Math.abs(getNextVy(-5) - (-6.235)) < 1e-9);
assert.strictEqual(getNextVy(-16), -16);

// 6. Physics check: Alternating 180-deg leg lifts (never both off ground at same time)
for (let t = 0; t < Math.PI * 2; t += 0.2) {
    const swing = Math.sin(t);
    const leftLift = swing > 0 ? -swing * 9 : 0;
    const rightLift = swing < 0 ? swing * 9 : 0;
    // Exactly one foot (or neither at zero crossing) can be lifted
    assert(!(leftLift < 0 && rightLift < 0), "Both feet must never lift simultaneously in walk cycle");
}

// 7. Grid-aware menu focus movement (mirrors moveFocus in script.js)
function moveFocus(items, cur, dir, center) {
    const c = center(cur);
    let best = null, bestScore = Infinity;
    for (const el of items) {
        if (el === cur) continue;
        const t = center(el);
        const dx = t.x - c.x, dy = t.y - c.y;
        let primary, secondary;
        if (dir === "left") { if (dx >= -1) continue; primary = -dx; secondary = Math.abs(dy); }
        else if (dir === "right") { if (dx <= 1) continue; primary = dx; secondary = Math.abs(dy); }
        else if (dir === "up") { if (dy >= -1) continue; primary = -dy; secondary = Math.abs(dx); }
        else { if (dy <= 1) continue; primary = dy; secondary = Math.abs(dx); }
        const score = primary + secondary * 2;
        if (score < bestScore) { bestScore = score; best = el; }
    }
    return best || cur;
}
const center = e => ({ x: e.x, y: e.y });
const grid = [
    { n: "c0", x: 100, y: 300 }, { n: "c1", x: 300, y: 300 }, { n: "c2", x: 500, y: 300 },
    { n: "c3", x: 100, y: 500 }, { n: "c4", x: 300, y: 500 }, { n: "c5", x: 500, y: 500 },
    { n: "s0", x: 100, y: 700 }, { n: "s1", x: 300, y: 700 }
];
const f = (name, dir) => moveFocus(grid, grid.find(e => e.n === name), dir, center).n;
assert.strictEqual(f("c0", "right"), "c1");
assert.strictEqual(f("c1", "left"), "c0");
assert.strictEqual(f("c0", "down"), "c3");
assert.strictEqual(f("c5", "up"), "c2");
assert.strictEqual(f("c3", "down"), "s0");
assert.strictEqual(f("c4", "down"), "s1");
assert.strictEqual(f("c2", "right"), "c2", "Right at edge stays put");
assert.strictEqual(f("c0", "up"), "c0", "Up at top stays put");

console.log("All gameplay logic checks passed!");
