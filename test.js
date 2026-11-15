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

console.log("All gameplay logic checks passed!");
