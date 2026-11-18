const arena = document.getElementById("arena");
const gameCanvas = document.getElementById("gameCanvas");
const gameCtx = gameCanvas.getContext("2d");
let ctx = gameCtx;

const playerHealthElement = document.getElementById("playerHealth");
const enemyHealthElement = document.getElementById("enemyHealth");
const playerExElement = document.getElementById("playerEx");
const enemyExElement = document.getElementById("enemyEx");
const playerClassNameElement = document.getElementById("playerClassName");
const enemyClassNameElement = document.getElementById("enemyClassName");
const playerRoundsContainer = document.getElementById("playerRounds");
const enemyRoundsContainer = document.getElementById("enemyRounds");
const timerDisplay = document.getElementById("timerDisplay");
const statusBanner = document.getElementById("statusBanner");

let statusBannerTimeout = null;
function setStatus(message, duration = 1600) {
    if (!statusBanner) return;
    statusBanner.textContent = message;
    statusBanner.classList.remove("hidden");
    statusBanner.classList.remove("status-banner-show");
    void statusBanner.offsetWidth;
    statusBanner.classList.add("status-banner-show");
    if (statusBannerTimeout) clearTimeout(statusBannerTimeout);
    if (duration > 0) {
        statusBannerTimeout = setTimeout(() => {
            statusBanner.classList.add("hidden");
        }, duration);
    }
}
function clearStatus() {
    if (statusBannerTimeout) clearTimeout(statusBannerTimeout);
    statusBannerTimeout = null;
    if (statusBanner) statusBanner.classList.add("hidden");
}

// DOM Menu & Modal elements
const mainMenu = document.getElementById("mainMenu");
const btnStart1P = document.getElementById("btnStart1P");
const btnStart2P = document.getElementById("btnStart2P");
const charSelectTitle = document.getElementById("charSelectTitle");
const charSelectSubtitle = document.getElementById("charSelectSubtitle");
const btnHowToPlay = document.getElementById("btnHowToPlay");
const howToPlayModal = document.getElementById("howToPlayModal");
const btnCloseModal = document.getElementById("btnCloseModal");
const pauseMenu = document.getElementById("pauseMenu");
const btnResume = document.getElementById("btnResume");
const btnRestart = document.getElementById("btnRestart");
const btnMainMenu = document.getElementById("btnMainMenu");
const btnPause = document.getElementById("btnPause");

// Character selection menu overlays
const charSelectMenu = document.getElementById("charSelectMenu");
const btnBackToMenu = document.getElementById("btnBackToMenu");

// DOM Countdown & Game Over elements
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownText = document.getElementById("countdownText");
const gameOverMenu = document.getElementById("gameOverMenu");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverResult = document.getElementById("gameOverResult");
const btnGameOverRestart = document.getElementById("btnGameOverRestart");
const btnGameOverMainMenu = document.getElementById("btnGameOverMainMenu");

// Settings UI
const settingsModal = document.getElementById("settingsModal");
const btnSettings = document.getElementById("btnSettings");
const btnPauseSettings = document.getElementById("btnPauseSettings");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const settingVolume = document.getElementById("settingVolume");
const settingMute = document.getElementById("settingMute");
const settingShake = document.getElementById("settingShake");
const settingRoundTime = document.getElementById("settingRoundTime");
const settingDifficulty = document.getElementById("settingDifficulty");
const btnChangeChar = document.getElementById("btnChangeChar");

const keys = {};

const groundHeight = 45;
const gravity = 0.95;
const fallGravity = 1.30 * gravity;
const terminalVelocity = -16;
const airDrag = 0.97;
const groundMoveFriction = 0.86;
const groundStopFriction = 0.45;

// Live character previews in the select screen (reuse drawFighter with a custom ctx)
const previewCanvases = [];
let previewAnimRAF = null;

function renderFighterPreview(previewCtx, char, t) {
    const w = 90;
    const h = 130;
    previewCtx.clearRect(0, 0, w, h);
    char.animTime = t;
    char.isMoving = false;
    char.isAttacking = false;
    char.isBlocking = false;
    char.isShooting = false;
    char.isHitstun = 0;
    char.hitTimer = 0;
    char.isJumping = false;
    char.y = 0;
    char.facing = 1;

    const prevCtx = ctx;
    const prevW = arenaWidth;
    const prevH = arenaHeight;
    ctx = previewCtx;
    previewCtx.save();
    // Scale fighter so body + weapon fit. Fighter faces right, blade sticks out
    // only on one side, so budget width = reach on the blade side.
    const reach = 4 + 25 + 8 + (char.bladeLength || 45) + 12;
    const bodyH = (char.height || 130) + 12;
    const scale = Math.min((w - 6) / reach, (h - 8) / (bodyH + 40));
    previewCtx.scale(scale, scale);
    const scaledW = w / scale;
    const scaledH = h / scale;
    arenaWidth = scaledW;
    arenaHeight = scaledH;
    // Shift body left so the right-side weapon stays inside the canvas
    const centerOffset = reach / 2 - 20;
    drawFighter(char, true, scaledW / 2 - centerOffset);
    previewCtx.restore();
    ctx = prevCtx;
    arenaWidth = prevW;
    arenaHeight = prevH;
}

function initPreviews() {
    if (previewCanvases.length) return;
    document.querySelectorAll(".char-preview-canvas").forEach(canvas => {
        const className = canvas.dataset.class;
        const pctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const w = 90, h = 130;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        pctx.scale(dpr, dpr);
        const dummy = {};
        applyClassStats(dummy, className);
        previewCanvases.push({ ctx: pctx, char: dummy, w, h });
    });
    let t = 0;
    function loop() {
        t += 0.06;
        previewCanvases.forEach(p => {
            renderFighterPreview(p.ctx, p.char, t);
        });
        previewAnimRAF = requestAnimationFrame(loop);
    }
    loop();
}

// Settings (persisted)
const SETTINGS_KEY = "neonFighter.settings";
const DEFAULT_SETTINGS = { volume: 0.8, muted: false, screenShake: true, roundTime: 99, difficulty: "easy" };
let settings = loadSettings();

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) { /* ponytail: storage unavailable (private mode) — settings stay in memory */ }
}

function applySettings() {
    masterGain.gain.value = settings.muted ? 0 : settings.volume;
}

// Game states
let gameRunning = false;
let inMainMenu = true;
let isPaused = false;
let isCountingDown = false;
let gameMode = "1P"; // "1P" atau "2P"
let selectingPlayer = 1; // 1 atau 2
let selectedEnemyClass = "striker";
let selectedStage = "neon"; // default stage
let playerRoundsWon = 0;
let enemyRoundsWon = 0;
let currentRound = 1;
let roundEpoch = 0;
let activeTimeouts = [];
const tapTracker = {
    p1: { key: null, time: 0 },
    p2: { key: null, time: 0 }
};

// Arena dimensions
let arenaWidth = 950;
let arenaHeight = 450;

// Dynamic arrays for projectiles & particles
let projectiles = [];
let particles = [];
let damageNumbers = [];
let hitStopFrames = 0;
let screenShake = 0;
let roundOver = false;
let roundTimer = 99;
let roundTimerInterval = null;
let bgAnimTime = 0;
let koSlowMo = 0;
let koSlowMoTarget = null;

function scheduleTimeout(fn, delay) {
    const id = setTimeout(() => {
        const idx = activeTimeouts.indexOf(id);
        if (idx !== -1) activeTimeouts.splice(idx, 1);
        fn();
    }, delay);
    activeTimeouts.push(id);
    return id;
}

function clearAllTimeouts() {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts = [];
}

// Input Configuration
const KEY_MAP = {
    p1: {
        left: ['a', 'ArrowLeft'],
        right: ['d', 'ArrowRight'],
        up: ['w', 'ArrowUp'],
        down: ['s', 'ArrowDown'],
        attack: ['j', 'KeyJ'],
        special: ['k', 'KeyK'],
        pause: ['p', 'KeyP'],
        restart: ['r', 'KeyR']
    },
    p2: {
        left: ['ArrowLeft'],
        right: ['ArrowRight'],
        up: ['ArrowUp'],
        down: ['ArrowDown'],
        attack: ['0', 'Numpad0'],
        special: ['1', 'Numpad1'],
        pause: ['p', 'KeyP'],
        restart: ['r', 'KeyR']
    }
};

const GAMEPAD_MAP = {
    left: { axis: 0, threshold: -0.3 },
    right: { axis: 0, threshold: 0.3 },
    up: { axis: 1, threshold: -0.3 },
    down: { axis: 1, threshold: 0.3 },
    attack: { button: 0 },      // A / Cross
    special: { button: 1 },     // B / Circle
    block: { button: 6 },       // LB / L1
    pause: { button: 9 },       // Start / Options
    restart: { button: 8 }      // Select / Share
};

let gamepads = [null, null];
let gamepadPrevState = [{}, {}];

function pollGamepads() {
    const gpList = navigator.getGamepads();
    gamepads[0] = gpList[0] || null;
    gamepads[1] = gpList[1] || null;
}

function getGamepadInput(playerIndex) {
    const gp = gamepads[playerIndex];
    if (!gp) return null;

    const prev = gamepadPrevState[playerIndex] || {};
    const curr = {};

    // Axes
    ['left', 'right', 'up', 'down'].forEach(dir => {
        const map = GAMEPAD_MAP[dir];
        const val = gp.axes[map.axis] || 0;
        curr[dir] = val * (dir === 'left' || dir === 'up' ? -1 : 1) > Math.abs(map.threshold);
    });

    // Buttons
    ['attack', 'special', 'block', 'pause', 'restart'].forEach(btn => {
        const map = GAMEPAD_MAP[btn];
        const pressed = gp.buttons[map.button]?.pressed || false;
        curr[btn] = pressed && !prev[btn]; // Edge detection for tap actions
    });

    gamepadPrevState[playerIndex] = curr;
    return curr;
}

// Touch Controls
const touchState = {
    p1: { joystick: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 }, buttons: {} },
    p2: { joystick: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 }, buttons: {} }
};

function initTouchControls() {
    const touchControls = document.getElementById('touchControls');
    const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;

    if (isMobile && !inMainMenu) {
        touchControls.classList.remove('hidden');
        setupJoystick('p1Joystick', 'p1');
        setupJoystick('p2Joystick', 'p2');
        setupTouchButtons();
    } else {
        touchControls.classList.add('hidden');
    }
}

function setupJoystick(joystickId, player) {
    const joystick = document.getElementById(joystickId);
    const stick = joystick.querySelector('.joystick-stick');
    const base = joystick.querySelector('.joystick-base');
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const maxDist = 45;

    function updateStick(x, y) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const clampedDist = Math.min(dist, maxDist);
        const stickX = centerX + Math.cos(angle) * clampedDist - 20;
        const stickY = centerY + Math.sin(angle) * clampedDist - 20;

        stick.style.transform = `translate(${stickX}px, ${stickY}px)`;

        // Update keys based on joystick angle
        const deadzone = 0.3;
        const normX = Math.cos(angle) * (clampedDist / maxDist);
        const normY = Math.sin(angle) * (clampedDist / maxDist);

        if (player === 'p1') {
            keys['a'] = normX < -deadzone;
            keys['d'] = normX > deadzone;
            keys['w'] = normY < -deadzone;
            keys['s'] = normY > deadzone;
        } else {
            keys['arrowleft'] = normX < -deadzone;
            keys['arrowright'] = normX > deadzone;
            keys['arrowup'] = normY < -deadzone;
            keys['arrowdown'] = normY > deadzone;
        }
    }

    function resetStick() {
        stick.style.transform = 'translate(30px, 30px)';
        if (player === 'p1') {
            keys['a'] = keys['d'] = keys['w'] = keys['s'] = false;
        } else {
            keys['arrowleft'] = keys['arrowright'] = keys['arrowup'] = keys['arrowdown'] = false;
        }
    }

    joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchState[player].joystick.active = true;
        const touch = e.touches[0];
        const rect = joystick.getBoundingClientRect();
        updateStick(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });

    joystick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!touchState[player].joystick.active) return;
        const touch = e.touches[0];
        const rect = joystick.getBoundingClientRect();
        updateStick(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });

    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchState[player].joystick.active = false;
        resetStick();
    }, { passive: false });

    joystick.addEventListener('touchcancel', (e) => {
        touchState[player].joystick.active = false;
        resetStick();
    }, { passive: false });
}

function setupTouchButtons() {
    document.querySelectorAll('.touch-btn').forEach(btn => {
        const key = btn.dataset.key;
        const action = btn.dataset.action;

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[key] = true;
            btn.classList.add('active');
        }, { passive: false });

        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[key] = false;
            btn.classList.remove('active');
        }, { passive: false });

        btn.addEventListener('touchcancel', (e) => {
            keys[key] = false;
            btn.classList.remove('active');
        }, { passive: false });
    });
}

// Show/hide touch controls on resize
window.addEventListener('resize', () => {
    initTouchControls();
});

// Audio Synthesizer (Web Audio API)
// ponytail: synth Sfx via Web Audio API. Upgrade to audio assets if custom sounds needed.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);
document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });

function playSound(type) {
    if (settings.muted) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    if (type === 'slash') {
        // Laser blade swing: triangle pitch sweep + quick decay
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);

        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.18, now + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'hit') {
        // Impact hit: retro laser hit sweep
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.start(now);
        osc.stop(now + 0.12);
    } else if (type === 'block') {
        // Laser deflection shield block: high sine drop
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1300, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.09);

        gainNode.gain.setValueAtTime(0.22, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.start(now);
        osc.stop(now + 0.09);
    } else if (type === 'projectile') {
        // Ranged Hadouken shoot: sci-fi blast frequency drop
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.22);

        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc.start(now);
        osc.stop(now + 0.24);
    } else if (type === 'jump') {
        // Short upward jump sweep
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.start(now);
        osc.stop(now + 0.08);
    } else if (type === 'win') {
        // Major triumphant retro chord arpeggio
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, idx) => {
            const oscNode = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscNode.connect(gainNode);
            gainNode.connect(masterGain);

            oscNode.type = 'sine';
            oscNode.frequency.setValueAtTime(freq, now + idx * 0.09);

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.15, now + idx * 0.09 + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);

            oscNode.start(now + idx * 0.09);
            oscNode.stop(now + idx * 0.09 + 0.3);
        });
    }
}

function triggerHitFlash() {
    // Screen flash disabled: caused distracting flicker on every hit.
}

// Character classes specifications
const CHARACTER_CLASSES = {
    striker: {
        name: "Striker",
        maxHp: 100,
        speed: 5,
        jumpPower: 16,
        damage: 10,
        color: "#3b82f6",
        lightColor: "#60a5fa",
        shadowColor: "#2563eb",
        weaponType: "saber",
        bladeLength: 45,
        lineWidth: 5,
        projectileColor: "#60a5fa",
        knockbackResistance: 1.0,
        juggleDecay: 0.92
    },
    titan: {
        name: "Titan",
        maxHp: 130,
        speed: 3.5,
        jumpPower: 14,
        damage: 16,
        color: "#22c55e",
        lightColor: "#86efac",
        shadowColor: "#15803d",
        weaponType: "greatsword",
        bladeLength: 60,
        lineWidth: 8,
        projectileColor: "#22c55e",
        knockbackResistance: 1.4,
        juggleDecay: 0.88
    },
    shadow: {
        name: "Shadow",
        maxHp: 85,
        speed: 6.8,
        jumpPower: 18,
        damage: 6.5,
        color: "#a855f7",
        lightColor: "#d8b4fe",
        shadowColor: "#7e22ce",
        weaponType: "daggers",
        bladeLength: 32,
        lineWidth: 4,
        projectileColor: "#a855f7",
        knockbackResistance: 0.8,
        juggleDecay: 0.95
    },
    mage: {
        name: "Mage",
        maxHp: 80,
        speed: 4,
        jumpPower: 15,
        damage: 8,
        color: "#f97316",
        lightColor: "#fb923c",
        shadowColor: "#c2410c",
        weaponType: "staff",
        bladeLength: 50,
        lineWidth: 4,
        projectileColor: "#f97316",
        knockbackResistance: 0.9,
        juggleDecay: 0.9
    },
    wrestler: {
        name: "Wrestler",
        maxHp: 150,
        speed: 3,
        jumpPower: 12,
        damage: 22,
        color: "#84cc16",
        lightColor: "#bef264",
        shadowColor: "#4d7c0f",
        weaponType: "gauntlets",
        bladeLength: 28,
        lineWidth: 6,
        projectileColor: "#84cc16",
        knockbackResistance: 1.6,
        juggleDecay: 0.85
    },
    assassin: {
        name: "Assassin",
        maxHp: 70,
        speed: 8,
        jumpPower: 20,
        damage: 9,
        color: "#ec4899",
        lightColor: "#f472b6",
        shadowColor: "#be185d",
        weaponType: "claws",
        bladeLength: 30,
        lineWidth: 3,
        projectileColor: "#ec4899",
        knockbackResistance: 0.7,
        juggleDecay: 0.98
    }
};

const STAGES = {
    neon: {
        name: "NEON CITY",
        skyColors: ["#0b0f1a", "#111827", "#030712"],
        groundColor: "#111827",
        neonColor: "#facc15",
        gridColor: "rgba(59, 130, 246, 0.06)",
        parallaxLayers: [
            { color: "rgba(59, 130, 246, 0.04)", speed: 0.05, yStart: 0.1 },
            { color: "rgba(168, 85, 247, 0.03)", speed: 0.1, yStart: 0.3 },
        ],
        ambientParticles: { color: "#60a5fa", count: 2 },
    },
    dojo: {
        name: "ANCIENT DOJO",
        skyColors: ["#1c1917", "#292524", "#1c1917"],
        groundColor: "#3d2f22",
        neonColor: "#f97316",
        gridColor: "rgba(245, 158, 11, 0.05)",
        parallaxLayers: [
            { color: "rgba(245, 158, 11, 0.04)", speed: 0.05, yStart: 0.1 },
            { color: "rgba(120, 53, 15, 0.03)", speed: 0.1, yStart: 0.4 },
        ],
        ambientParticles: { color: "#f97316", count: 3 },
    },
    void: {
        name: "VOID ARENA",
        skyColors: ["#050505", "#0f0f0f", "#000000"],
        groundColor: "#1a1a1a",
        neonColor: "#a855f7",
        gridColor: "rgba(168, 85, 247, 0.06)",
        parallaxLayers: [
            { color: "rgba(168, 85, 247, 0.06)", speed: 0.08, yStart: 0.05 },
            { color: "rgba(236, 72, 153, 0.04)", speed: 0.15, yStart: 0.25 },
        ],
        ambientParticles: { color: "#a855f7", count: 4 },
    },
    sunset: {
        name: "SUNSET ROOFTOP",
        skyColors: ["#7c2d12", "#9a3412", "#c2410c"],
        groundColor: "#3d2f22",
        neonColor: "#fbbf24",
        gridColor: "rgba(251, 191, 36, 0.05)",
        parallaxLayers: [
            { color: "rgba(251, 191, 36, 0.05)", speed: 0.04, yStart: 0.15 },
            { color: "rgba(234, 88, 12, 0.04)", speed: 0.08, yStart: 0.35 },
        ],
        ambientParticles: { color: "#fbbf24", count: 3 },
    }
};

// ponytail: procedural vector stickman rendering in drawFighter(). Upgrade to sprite atlas if pixel art imported.
let selectedPlayerClass = "striker";

// Default player & enemy stats
const player = {
    x: 120,
    y: 0,
    width: 70,
    height: 130,
    speed: 5,
    velocityX: 0,
    velocityY: 0,
    jumpPower: 15,
    hp: 100,
    targetHp: 100,
    ex: 0,
    facing: 1,
    isJumping: false,
    isAttacking: false,
    attackCooldown: false,
    isBlocking: false,
    isShooting: false,
    hitTimer: 0,
    isHitstun: 0,
    isJuggling: false,
    juggleCount: 0,
    animTime: 0,
    attackStartTime: 0,
    swordTrail: [],
    isMoving: false,
    className: "striker",
    knockbackResistance: 1.0,
    juggleDecay: 0.92,
    blockHoldTime: 0,
    landingRecovery: 0
};

const enemy = {
    x: 720,
    y: 0,
    width: 70,
    height: 130,
    speed: 2,
    velocityY: 0,
    hp: 100,
    targetHp: 100,
    ex: 0,
    facing: -1,
    isJumping: false,
    isAttacking: false,
    attackCooldown: false,
    isBlocking: false,
    isShooting: false,
    hitTimer: 0,
    isHitstun: 0,
    isJuggling: false,
    juggleCount: 0,
    animTime: 0,
    attackStartTime: 0,
    blockingTimer: 0,
    swordTrail: [],
    isMoving: false,
    className: "striker",
    aiState: "chase",
    aiStateTimer: 0,
    knockbackResistance: 1.0,
    juggleDecay: 0.92,
    blockHoldTime: 0,
    landingRecovery: 0
};

function applyClassStats(char, className) {
    char.className = className;
    const info = CHARACTER_CLASSES[className];
    if (char.width == null) char.width = 70;
    if (char.height == null) char.height = 130;
    char.maxHp = info.maxHp;
    char.hp = info.maxHp;
    char.targetHp = info.maxHp;
    char.speed = info.speed;
    char.jumpPower = info.jumpPower;
    char.damage = info.damage;
    char.color = info.color;
    char.lightColor = info.lightColor;
    char.shadowColor = info.shadowColor;
    char.weaponType = info.weaponType;
    char.bladeLength = info.bladeLength;
    char.lineWidth = info.lineWidth;
    char.projectileColor = info.projectileColor;
    char.knockbackResistance = info.knockbackResistance;
    char.juggleDecay = info.juggleDecay;
}

class Particle {
    constructor(x, y, color, vx, vy, size, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.life = life;
        this.maxLife = life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.15; // gravity
        this.vx *= 0.98; // friction
        this.life--;
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fill();
        ctx.restore();
    }
}

class DamageNumber {
    constructor(x, y, value, isCrit = false, isHeal = false) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.isCrit = isCrit;
        this.isHeal = isHeal;
        this.life = 60;
        this.maxLife = 60;
        this.vy = -1.5;
        this.scale = isCrit ? 1.5 : 1;
        this.alpha = 1;
    }

    update() {
        this.y += this.vy;
        this.vy *= 0.95;
        this.life--;
        this.alpha = this.life / this.maxLife;
        this.scale *= 0.99;
    }

    draw() {
        if (this.life <= 0) return;
        ctx.save();
        ctx.font = `bold ${Math.round(24 * this.scale)}px Orbitron`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const color = this.isHeal ? "#22c55e" : (this.isCrit ? "#facc15" : "#ef4444");
        const glowColor = this.isHeal ? "#22c55e" : (this.isCrit ? "#facc15" : "#ef4444");

        ctx.shadowBlur = 10;
        ctx.shadowColor = glowColor;
        ctx.fillStyle = color;
        ctx.globalAlpha = this.alpha;

        const prefix = this.isHeal ? "+" : "-";
        ctx.fillText(`${prefix}${this.value}`, this.x, this.y);

        ctx.restore();
    }
}

function spawnSparks(x, y, color) {
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4.5;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 1.5;
        const size = 1.5 + Math.random() * 2.5;
        const life = 15 + Math.random() * 20;
        particles.push(new Particle(x, y, color, vx, vy, size, life));
    }
}

function spawnDust(x, y) {
    for (let i = 0; i < 8; i++) {
        const vx = (Math.random() - 0.5) * 3.5;
        const vy = -Math.random() * 2.5;
        const size = 2.5 + Math.random() * 4;
        const life = 12 + Math.random() * 18;
        particles.push(new Particle(x, y, "rgba(255, 255, 255, 0.4)", vx, vy, size, life));
    }
}

function spawnImpactDust(x, y, color) {
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 2;
        const size = 2 + Math.random() * 4;
        const life = 15 + Math.random() * 20;
        particles.push(new Particle(x, y, color || "rgba(255, 255, 255, 0.5)", vx, vy, size, life));
    }
}

function resizeCanvas() {
    const rect = arena.getBoundingClientRect();
    arenaWidth = rect.width || 950;
    arenaHeight = rect.height || 450;

    const dpr = window.devicePixelRatio || 1;
    gameCanvas.width = arenaWidth * dpr;
    gameCanvas.height = arenaHeight * dpr;

    gameCtx.resetTransform();
    gameCtx.scale(dpr, dpr);
}

// Initial setup
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Clear keyboard input helper
function clearKeys() {
    for (const key in keys) {
        keys[key] = false;
    }
}

// Toggle status Pause
function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        pauseMenu.classList.remove("hidden");
        clearKeys();
    } else {
        pauseMenu.classList.add("hidden");
    }
}

function playCountdownSound() {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
}

function playCountdownFinalSound() {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(masterGain);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
    gainNode.gain.setValueAtTime(0.25, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
}

function updateRoundDots() {
    if (playerRoundsContainer) {
        const pDots = playerRoundsContainer.querySelectorAll(".round-dot");
        pDots.forEach((dot, idx) => {
            dot.classList.toggle("won", idx < playerRoundsWon);
        });
    }
    if (enemyRoundsContainer) {
        const eDots = enemyRoundsContainer.querySelectorAll(".round-dot");
        eDots.forEach((dot, idx) => {
            dot.classList.toggle("won", idx < enemyRoundsWon);
        });
    }
}

// Countdown before game starts
function startCountdown(callback, roundTitle) {
    isCountingDown = true;
    clearKeys();

    countdownOverlay.classList.remove("hidden");

    let count = 3;

    function runNumbers() {
        if (count > 0) {
            countdownText.textContent = count;
            playCountdownSound();

            countdownText.style.animation = 'none';
            countdownText.offsetHeight; // trigger reflow
            countdownText.style.animation = null;

            count--;
            scheduleTimeout(runNumbers, 850);
        } else {
            countdownText.textContent = "MULAI!";
            playCountdownFinalSound();

            countdownText.style.animation = 'none';
            countdownText.offsetHeight; // trigger reflow
            countdownText.style.animation = null;

            scheduleTimeout(() => {
                countdownOverlay.classList.add("hidden");
                isCountingDown = false;
                if (callback) callback();
            }, 600);
        }
    }

    if (roundTitle) {
        countdownText.textContent = roundTitle;
        playCountdownSound();
        scheduleTimeout(runNumbers, 900);
    } else {
        runNumbers();
    }
}

// Keyboard events
document.addEventListener("keydown", function (event) {
    if (inMainMenu) return;

    const key = event.key.toLowerCase();
    const code = event.code;

    if (key === "p" || key === "escape") {
        event.preventDefault();
        if (gameRunning && !isCountingDown) {
            togglePause();
        }
        return;
    }

    if (isPaused || isCountingDown) return;

    // Dash via Double Tap (A/D for P1, Left/Right arrows for P2)
    const now = Date.now();
    if (key === "a" || key === "d") {
        const last = tapTracker.p1;
        if (last.key === key && (now - last.time) < 260 && player.y <= 0 && player.isHitstun <= 0 && !player.isBlocking) {
            const dir = key === "a" ? -1 : 1;
            player.velocityX = dir * player.speed * 2.3;
            player.facing = dir;
            playSound('jump');
            spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);
            tapTracker.p1 = { key: null, time: 0 };
        } else {
            tapTracker.p1 = { key, time: now };
        }
    } else if (gameMode === "2P" && (code === "ArrowLeft" || code === "ArrowRight")) {
        const k = code === "ArrowLeft" ? "arrowleft" : "arrowright";
        const last = tapTracker.p2;
        if (last.key === k && (now - last.time) < 260 && enemy.y <= 0 && enemy.isHitstun <= 0 && !enemy.isBlocking) {
            const dir = k === "arrowleft" ? -1 : 1;
            enemy.velocityX = dir * enemy.speed * 2.3;
            enemy.facing = dir;
            playSound('jump');
            spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            tapTracker.p2 = { key: null, time: 0 };
        } else {
            tapTracker.p2 = { key: k, time: now };
        }
    }

    if (key === "0" || code === "Numpad0") {
        keys["0"] = true;
    } else if (key === "1" || code === "Numpad1") {
        keys["1"] = true;
    } else if (code === "ArrowLeft") {
        keys["arrowleft"] = true;
    } else if (code === "ArrowRight") {
        keys["arrowright"] = true;
    } else if (code === "ArrowUp") {
        keys["arrowup"] = true;
    } else if (code === "ArrowDown") {
        keys["arrowdown"] = true;
    } else {
        keys[key] = true;
    }

    if (key === "r") {
        restartGame();
    }
});

document.addEventListener("keyup", function (event) {
    if (inMainMenu || isPaused || isCountingDown) return;
    const key = event.key.toLowerCase();
    const code = event.code;

    if (key === "0" || code === "Numpad0") {
        keys["0"] = false;
    } else if (key === "1" || code === "Numpad1") {
        keys["1"] = false;
    } else if (code === "ArrowLeft") {
        keys["arrowleft"] = false;
    } else if (code === "ArrowRight") {
        keys["arrowright"] = false;
    } else if (code === "ArrowUp") {
        keys["arrowup"] = false;
    } else if (code === "ArrowDown") {
        keys["arrowdown"] = false;
    } else {
        keys[key] = false;
    }
});

// UI Menu buttons
btnStart1P.addEventListener("click", function () {
    mainMenu.classList.add("hidden");
    gameMode = "1P";
    selectingPlayer = 1;
    charSelectTitle.textContent = "PLAYER 1: SELECT CHARACTER";
    charSelectSubtitle.textContent = "Pilih Kelas Pertarungan Player 1";
    charSelectMenu.classList.remove("hidden");
    initPreviews();
});

btnStart2P.addEventListener("click", function () {
    mainMenu.classList.add("hidden");
    gameMode = "2P";
    selectingPlayer = 1;
    charSelectTitle.textContent = "PLAYER 1: SELECT CHARACTER";
    charSelectSubtitle.textContent = "Pilih Kelas Pertarungan Player 1";
    charSelectMenu.classList.remove("hidden");
    initPreviews();
});

btnHowToPlay.addEventListener("click", function () {
    howToPlayModal.classList.remove("hidden");
});

btnCloseModal.addEventListener("click", function () {
    howToPlayModal.classList.add("hidden");
});

btnResume.addEventListener("click", function () {
    togglePause();
});

btnPause.addEventListener("click", function () {
    if (gameRunning && !isCountingDown) {
        togglePause();
    }
});

btnRestart.addEventListener("click", function () {
    isPaused = false;
    pauseMenu.classList.add("hidden");
    restartGame();
});

btnMainMenu.addEventListener("click", function () {
    isPaused = false;
    pauseMenu.classList.add("hidden");
    inMainMenu = true;
    mainMenu.classList.remove("hidden");
    document.getElementById('touchControls').classList.add('hidden');
    restartGame();
});

btnGameOverRestart.addEventListener("click", function () {
    gameOverMenu.classList.add("hidden");
    restartGame();
});

btnGameOverMainMenu.addEventListener("click", function () {
    gameOverMenu.classList.add("hidden");
    inMainMenu = true;
    mainMenu.classList.remove("hidden");
    document.getElementById('touchControls').classList.add('hidden');
    restartGame();
});

// Character Selection Cards
document.getElementById("cardStriker").addEventListener("click", () => selectChar("striker"));
document.getElementById("cardTitan").addEventListener("click", () => selectChar("titan"));
document.getElementById("cardShadow").addEventListener("click", () => selectChar("shadow"));
document.getElementById("cardMage").addEventListener("click", () => selectChar("mage"));
document.getElementById("cardWrestler").addEventListener("click", () => selectChar("wrestler"));
document.getElementById("cardAssassin").addEventListener("click", () => selectChar("assassin"));

// Stage Selection Cards
document.getElementById("cardStageNeon").addEventListener("click", () => selectStage("neon"));
document.getElementById("cardStageDojo").addEventListener("click", () => selectStage("dojo"));
document.getElementById("cardStageVoid").addEventListener("click", () => selectStage("void"));
document.getElementById("cardStageSunset").addEventListener("click", () => selectStage("sunset"));

// Keyboard activation for role="button" cards (Enter / Space)
document.querySelectorAll('.char-card[role="button"], .stage-card[role="button"]').forEach(card => {
    card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            card.click();
        }
    });
});

btnBackToMenu.addEventListener("click", () => {
    charSelectMenu.classList.add("hidden");
    mainMenu.classList.remove("hidden");
    inMainMenu = true;
});

// Settings wiring
function syncSettingsUI() {
    settingVolume.value = Math.round(settings.volume * 100);
    settingMute.checked = settings.muted;
    settingShake.checked = settings.screenShake;
    settingRoundTime.value = String(settings.roundTime);
    settingDifficulty.value = settings.difficulty;
}

function openSettings() {
    syncSettingsUI();
    settingsModal.classList.remove("hidden");
}

btnSettings.addEventListener("click", openSettings);
btnPauseSettings.addEventListener("click", openSettings);
btnCloseSettings.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
    applySettings();
    saveSettings();
});

settingVolume.addEventListener("input", () => {
    settings.volume = Number(settingVolume.value) / 100;
    if (settings.muted && settings.volume > 0) {
        settings.muted = false;
        settingMute.checked = false;
    }
    applySettings();
});
settingMute.addEventListener("change", () => {
    settings.muted = settingMute.checked;
    applySettings();
});
settingShake.addEventListener("change", () => {
    settings.screenShake = settingShake.checked;
});
settingRoundTime.addEventListener("change", () => {
    settings.roundTime = Number(settingRoundTime.value);
});
settingDifficulty.addEventListener("change", () => {
    settings.difficulty = settingDifficulty.value;
});

btnChangeChar.addEventListener("click", openCharSelect);

function openCharSelect() {
    pauseMenu.classList.add("hidden");
    isPaused = false;
    inMainMenu = false;
    selectingPlayer = 1;
    charSelectTitle.textContent = "PLAYER 1: SELECT CHARACTER";
    charSelectSubtitle.textContent = "Pilih Kelas Pertarungan Player 1";
    charSelectMenu.classList.remove("hidden");
    initPreviews();
}

function selectChar(className) {
    if (selectingPlayer === 1) {
        selectedPlayerClass = className;
        if (gameMode === "1P") {
            charSelectMenu.classList.add("hidden");
            inMainMenu = false;
            initTouchControls();
            restartGame();
        } else {
            // Mode 2P: Lanjut ke Player 2
            selectingPlayer = 2;
            charSelectTitle.textContent = "PLAYER 2: SELECT CHARACTER";
            charSelectSubtitle.textContent = "Pilih Kelas Pertarungan Player 2";
        }
    } else if (selectingPlayer === 2) {
        selectedEnemyClass = className;
        charSelectMenu.classList.add("hidden");
        inMainMenu = false;
        initTouchControls();
        restartGame();
    }
}

function selectStage(stageName) {
    selectedStage = stageName;
    document.querySelectorAll(".stage-card").forEach(card => {
        card.classList.toggle("selected", card.dataset.stage === stageName);
    });
}

function handleHitstunPhysics(char) {
    if (char.isHitstun <= 0 && !char.isJuggling) return false;

    char.isHitstun = Math.max(0, char.isHitstun - 1);
    char.isBlocking = false;
    char.isMoving = false;

    const wasInAir = char.y > 0;
    char.velocityX *= airDrag;
    char.x += char.velocityX;
    char.y += char.velocityY;

    const currentGravity = char.velocityY < 0 ? fallGravity : gravity;
    char.velocityY = Math.max(terminalVelocity, char.velocityY - currentGravity);

    if (char.y <= 0) {
        char.y = 0;
        char.velocityY = 0;
        if (wasInAir) {
            char.isJumping = false;
            char.isJuggling = false;
            char.juggleCount = 0;
            char.landingRecovery = 4;
            spawnImpactDust(char.x + char.width / 2, arenaHeight - groundHeight, char.color);
        }
    }
    limitPosition(char);
    return true;
}

function applyMovementPhysics(char) {
    const isGrounded = char.y <= 0;
    const wasInAir = char.y > 0;

    if (char.isBlocking) char.velocityX = 0;

    if (isGrounded) {
        char.velocityX *= char.isMoving ? groundMoveFriction : groundStopFriction;
        if (!char.isMoving && Math.abs(char.velocityX) < 0.2) char.velocityX = 0;
        if (char.landingRecovery > 0) char.landingRecovery--;
    } else {
        char.velocityX *= airDrag;
    }

    char.velocityX = Math.max(-char.speed, Math.min(char.speed, char.velocityX));
    char.x += char.velocityX;
    char.animTime += char.isMoving ? Math.abs(char.velocityX) * 0.045 : (char.isJuggling ? 0.02 : 0.035);
    char.y += char.velocityY;

    const currentGravity = char.velocityY < 0 ? fallGravity : gravity;
    char.velocityY = Math.max(terminalVelocity, char.velocityY - currentGravity);

    if (char.y <= 0) {
        char.y = 0;
        char.velocityY = 0;
        if (wasInAir) {
            char.isJumping = false;
            char.isJuggling = false;
            char.juggleCount = 0;
            char.landingRecovery = 4;
            spawnImpactDust(char.x + char.width / 2, arenaHeight - groundHeight, char.color);
        }
    }
    limitPosition(char);
}

function triggerGuardCrush(char) {
    char.isBlocking = false;
    char.blockHoldTime = 0;
    char.isHitstun = 75;
    char.hitTimer = 25;
    playSound('hit');
    const sparkX = char.x + char.width / 2;
    const sparkY = (arenaHeight - groundHeight) - char.y - char.height / 2;
    spawnSparks(sparkX, sparkY, "#ef4444");
    spawnImpactDust(sparkX, sparkY, "#ef4444");
    screenShake = 16;
    damageNumbers.push(new DamageNumber(sparkX, sparkY - 30, "CRUSH!", true));
    setStatus("GUARD CRUSH!", 1200);
}

function updatePlayerMovement() {
    if (!gameRunning) return;

    player.ex = Math.min(100, player.ex + 0.05);
    if (handleHitstunPhysics(player)) return;

    player.isMoving = false;
    const isGrounded = player.y <= 0;

    if (keys["s"] && isGrounded) {
        player.isBlocking = true;
        player.blockHoldTime = (player.blockHoldTime || 0) + 1;
        if (player.blockHoldTime >= 180) {
            triggerGuardCrush(player);
        }
    } else {
        player.isBlocking = false;
        player.blockHoldTime = Math.max(0, (player.blockHoldTime || 0) - 2);

        if (isGrounded) {
            if (keys["a"]) {
                player.velocityX -= player.speed * 0.22;
                player.facing = -1;
                player.isMoving = true;
                if (Math.random() < 0.2) spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);
            }
            if (keys["d"]) {
                player.velocityX += player.speed * 0.22;
                player.facing = 1;
                player.isMoving = true;
                if (Math.random() < 0.2) spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);
            }
            if (keys["w"] && !player.isJumping) {
                player.velocityY = player.jumpPower;
                player.isJumping = true;
                playSound('jump');
                spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);
            }
        } else {
            if (keys["a"]) {
                player.velocityX -= player.speed * 0.08;
                player.facing = -1;
            }
            if (keys["d"]) {
                player.velocityX += player.speed * 0.08;
                player.facing = 1;
            }
        }
    }

    applyMovementPhysics(player);

    if (keys["j"]) {
        playerAttack();
        keys["j"] = false;
    }
    if (keys["k"]) {
        playerShoot();
        keys["k"] = false;
    }
}

function updateEnemyPlayerMovement() {
    if (!gameRunning) return;

    enemy.ex = Math.min(100, enemy.ex + 0.05);
    if (handleHitstunPhysics(enemy)) return;

    enemy.isMoving = false;
    const isGrounded = enemy.y <= 0;

    if (keys["arrowdown"] && isGrounded) {
        enemy.isBlocking = true;
        enemy.blockHoldTime = (enemy.blockHoldTime || 0) + 1;
        if (enemy.blockHoldTime >= 180) {
            triggerGuardCrush(enemy);
        }
    } else {
        enemy.isBlocking = false;
        enemy.blockHoldTime = Math.max(0, (enemy.blockHoldTime || 0) - 2);

        if (isGrounded) {
            if (keys["arrowleft"]) {
                enemy.velocityX -= enemy.speed * 0.22;
                enemy.facing = -1;
                enemy.isMoving = true;
                if (Math.random() < 0.2) spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            }
            if (keys["arrowright"]) {
                enemy.velocityX += enemy.speed * 0.22;
                enemy.facing = 1;
                enemy.isMoving = true;
                if (Math.random() < 0.2) spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            }
            if (keys["arrowup"] && !enemy.isJumping) {
                enemy.velocityY = enemy.jumpPower;
                enemy.isJumping = true;
                playSound('jump');
                spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            }
        } else {
            if (keys["arrowleft"]) {
                enemy.velocityX -= enemy.speed * 0.08;
                enemy.facing = -1;
            }
            if (keys["arrowright"]) {
                enemy.velocityX += enemy.speed * 0.08;
                enemy.facing = 1;
            }
        }
    }

    applyMovementPhysics(enemy);

    if (keys["0"]) {
        enemyAttack();
        keys["0"] = false;
    }
    if (keys["1"]) {
        enemyShoot();
        keys["1"] = false;
    }
}

function updateEnemyAI() {
    if (!gameRunning) return;

    enemy.ex = Math.min(100, enemy.ex + 0.05);
    if (handleHitstunPhysics(enemy)) return;

    enemy.isMoving = false;
    const isGrounded = enemy.y <= 0;
    const distance = getDistance(player, enemy);
    const isEasyMode = settings.difficulty === "easy";

    // AI Blocking Reaction - easier in 1P
    const blockChance = isEasyMode ? 0.008 : 0.015;
    const blockDistance = isEasyMode ? 100 : 130;
    const blockTimer = isEasyMode ? 8 : 12;

    if (enemy.blockingTimer > 0) {
        enemy.blockingTimer--;
        enemy.isBlocking = true;
        enemy.blockHoldTime = (enemy.blockHoldTime || 0) + 1;
        if (enemy.blockHoldTime >= 180) {
            enemy.blockingTimer = 0;
            triggerGuardCrush(enemy);
        }
    } else {
        enemy.isBlocking = false;
        enemy.blockHoldTime = Math.max(0, (enemy.blockHoldTime || 0) - 2);
        if (player.isAttacking && distance < blockDistance && Math.random() < blockChance && !enemy.attackCooldown) {
            enemy.isBlocking = true;
            enemy.blockingTimer = blockTimer;
        }
    }

    // AI State Machine - easier in 1P
    if (enemy.aiStateTimer <= 0) {
        const rand = Math.random();

        if (distance > 220) {
            const chaseChance = isEasyMode ? 0.55 : 0.70;
            const shootChance = isEasyMode ? 0.70 : 0.85;
            if (rand < chaseChance) enemy.aiState = "chase";
            else if (rand < shootChance) enemy.aiState = "shoot";
            else enemy.aiState = "idle";
            enemy.aiStateTimer = 40 + Math.random() * 40;
        } else {
            if (enemy.attackCooldown) {
                const retreatChance = isEasyMode ? 0.60 : 0.50;
                const idleChance = isEasyMode ? 0.80 : 0.75;
                if (rand < retreatChance) enemy.aiState = "retreat";
                else if (rand < idleChance) enemy.aiState = "idle";
                else enemy.aiState = "chase";
            } else {
                const attackChance = isEasyMode ? 0.20 : 0.35;
                const defendChance = isEasyMode ? 0.30 : 0.50;
                if (rand < attackChance) enemy.aiState = "chase";
                else if (rand < defendChance) enemy.aiState = "defend";
                else enemy.aiState = "idle";
            }
            enemy.aiStateTimer = 45 + Math.random() * 50;
        }
    } else {
        enemy.aiStateTimer--;
    }

    // Execute State
    if (enemy.aiState === "shoot") {
        if (enemy.ex >= 30 && Math.random() < (isEasyMode ? 0.5 : 0.8)) {
            enemyShoot();
        } else {
            enemy.aiState = "chase";
        }
    }

    if (player.x < enemy.x) enemy.facing = -1;
    else enemy.facing = 1;

    if (enemy.aiState === "defend") {
        enemy.isBlocking = true;
    } else if (enemy.aiState === "chase") {
        const chaseDistance = isEasyMode ? 130 : 110;
        const attackChance = isEasyMode ? 0.45 : 0.70;

        if (distance > chaseDistance) {
            enemy.isMoving = true;
            // Occasional AI dash forward if far away
            if (distance > 210 && Math.random() < 0.025 && isGrounded) {
                const dir = player.x < enemy.x ? -1 : 1;
                enemy.velocityX = dir * enemy.speed * 2.2;
                spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            } else {
                enemy.velocityX += (player.x < enemy.x ? -1 : 1) * enemy.speed * 0.18;
            }

            if (Math.random() < 0.02 && !enemy.isJumping && isGrounded) {
                spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            }
        } else if (Math.random() < attackChance) {
            enemyAttack();
        }
    } else if (enemy.aiState === "retreat") {
        enemy.isMoving = true;
        enemy.animTime += 0.15;
        const retreatSpeed = enemy.speed * 0.75;
        enemy.velocityX += (player.x < enemy.x ? 1 : -1) * retreatSpeed * 0.18;

        if (Math.random() < 0.03 && !enemy.isJumping && isGrounded) {
            spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
        }
    } else if (enemy.aiState === "idle") {
        enemy.isMoving = false;
    }

    applyMovementPhysics(enemy);
}

function playerAttack() {
    if (!gameRunning) return;
    if (player.attackCooldown) return;
    if (player.isBlocking || player.isShooting) return;

    player.isAttacking = true;
    player.attackCooldown = true;
    player.attackStartTime = Date.now();

    playSound('slash');
    spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);

    const distance = getDistance(player, enemy);
    const enemyIsInFront = isTargetInFront(player, enemy);

    if (distance < (player.bladeLength + 70) && enemyIsInFront) {
        // Cek jika musuh menangkis dan menghadap player
        if (enemy.isBlocking && enemy.facing === -player.facing) {
            enemy.hp -= 1; // chip damage
            enemy.hp = Math.max(enemy.hp, 0);

            // Tangkisan mengisi EX target
            enemy.ex = Math.min(100, enemy.ex + 10);

            // Dorongan balik kecil
            enemy.velocityX += player.facing * 8 / (enemy.knockbackResistance || 1);

            playSound('block');

            // Efek percikan perisai kuning emas
            const sparkX = enemy.x + (enemy.width / 2) - player.facing * 20;
            const sparkY = (arenaHeight - groundHeight) - enemy.y - enemy.height / 2;
            spawnSparks(sparkX, sparkY, "#facc15");
            spawnImpactDust(sparkX, sparkY, "#facc15");
        } else {
            // Serangan telak - apply knockback/juggle
            enemy.hp -= player.damage;
            enemy.hp = Math.max(enemy.hp, 0);
            enemy.hitTimer = 12;

            // Calculate knockback based on resistance
            const kbResist = enemy.knockbackResistance || 1;
            const baseKnockbackX = 8 / kbResist;
            const baseKnockbackY = 10 / kbResist;

            // Ground hit vs air hit
            const wasGrounded = enemy.y <= 0;
            const isJuggle = enemy.isJuggling || (!wasGrounded && enemy.juggleCount < 3);

            if (isJuggle || !wasGrounded) {
                // Air juggle - launch upward
                enemy.isJuggling = true;
                enemy.juggleCount++;
                enemy.velocityY = baseKnockbackY * (1.2 - enemy.juggleCount * 0.15); // decaying juggle height
                enemy.velocityX += player.facing * baseKnockbackX * 0.8;
                enemy.isHitstun = 18 + enemy.juggleCount * 3;
                hitStopFrames = 8;
                screenShake = 10;
            } else {
                // Ground hit - horizontal knockback with slight lift
                enemy.velocityX += player.facing * baseKnockbackX * 1.5;
                enemy.velocityY = baseKnockbackY * 0.6;
                enemy.isHitstun = 16;
                hitStopFrames = 6;
                screenShake = 8;
                enemy.isJuggling = true; // allow follow-up juggles
                enemy.juggleCount = 1;
            }

            // Serangan sukses menambah EX penyerang
            player.ex = Math.min(100, player.ex + 15);
            enemy.ex = Math.min(100, enemy.ex + 6);

            playSound('hit');
            triggerHitFlash();

            // Damage number popup
            const dmgX = enemy.x + enemy.width / 2;
            const dmgY = (arenaHeight - groundHeight) - enemy.y - enemy.height / 2;
            const isCrit = enemy.isJuggling; // Crit on juggle hits
            damageNumbers.push(new DamageNumber(dmgX, dmgY, Math.round(player.damage), isCrit));

            // Efek darah/percikan merah
            const sparkX = enemy.x + enemy.width / 2;
            const sparkY = (arenaHeight - groundHeight) - enemy.y - enemy.height / 2;
            spawnSparks(sparkX, sparkY, enemy.lightColor);
            spawnImpactDust(sparkX, sparkY, enemy.lightColor);
        }

        updateHealthBars();
        checkWinner();
    }

    scheduleTimeout(() => { player.isAttacking = false; }, 180);
    scheduleTimeout(() => { player.attackCooldown = false; }, 450);
}

function enemyAttack() {
    if (!gameRunning) return;
    if (enemy.attackCooldown) return;
    if (enemy.isBlocking || enemy.isShooting) return;

    enemy.isAttacking = true;
    enemy.attackCooldown = true;
    enemy.attackStartTime = Date.now();

    playSound('slash');
    spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);

    const distance = getDistance(enemy, player);
    const playerIsInFront = isTargetInFront(enemy, player);

    if (distance < (enemy.bladeLength + 70) && playerIsInFront) {
        // Cek jika player menangkis
        if (player.isBlocking && player.facing === -enemy.facing) {
            player.hp -= 1;
            player.hp = Math.max(player.hp, 0);

            player.ex = Math.min(100, player.ex + 10);

            player.velocityX += enemy.facing * 8 / (player.knockbackResistance || 1);

            playSound('block');

            const sparkX = player.x + (player.width / 2) - enemy.facing * 20;
            const sparkY = (arenaHeight - groundHeight) - player.y - player.height / 2;
            spawnSparks(sparkX, sparkY, "#facc15");
            spawnImpactDust(sparkX, sparkY, "#facc15");
        } else {
            // Serangan telak - apply knockback/juggle
            player.hp -= enemy.damage;
            player.hp = Math.max(player.hp, 0);
            player.hitTimer = 12;

            const kbResist = player.knockbackResistance || 1;
            const baseKnockbackX = 8 / kbResist;
            const baseKnockbackY = 10 / kbResist;

            const wasGrounded = player.y <= 0;
            const isJuggle = player.isJuggling || (!wasGrounded && player.juggleCount < 3);

            if (isJuggle || !wasGrounded) {
                player.isJuggling = true;
                player.juggleCount++;
                player.velocityY = baseKnockbackY * (1.2 - player.juggleCount * 0.15);
                player.velocityX += enemy.facing * baseKnockbackX * 0.8;
                player.isHitstun = 18 + player.juggleCount * 3;
                hitStopFrames = 8;
                screenShake = 10;
            } else {
                player.velocityX += enemy.facing * baseKnockbackX * 1.5;
                player.velocityY = baseKnockbackY * 0.6;
                player.isHitstun = 16;
                hitStopFrames = 6;
                screenShake = 8;
                player.isJuggling = true;
                player.juggleCount = 1;
            }

            enemy.ex = Math.min(100, enemy.ex + 15);
            player.ex = Math.min(100, player.ex + 6);

            playSound('hit');
            triggerHitFlash();

            // Damage number popup
            const dmgX = player.x + player.width / 2;
            const dmgY = (arenaHeight - groundHeight) - player.y - player.height / 2;
            const isCrit = player.isJuggling;
            damageNumbers.push(new DamageNumber(dmgX, dmgY, Math.round(enemy.damage), isCrit));

            const sparkX = player.x + player.width / 2;
            const sparkY = (arenaHeight - groundHeight) - player.y - player.height / 2;
            spawnSparks(sparkX, sparkY, player.lightColor);
            spawnImpactDust(sparkX, sparkY, player.lightColor);
        }

        updateHealthBars();
        checkWinner();
    }

    const duration = gameMode === "2P" ? 180 : 200;
    const cooldown = gameMode === "2P" ? 450 : 900;

    scheduleTimeout(() => { enemy.isAttacking = false; }, duration);
    scheduleTimeout(() => { enemy.attackCooldown = false; }, cooldown);
}

function executeExSkill(user, target) {
    if (!gameRunning || roundOver) return;
    if (user.ex < 30) return;
    if (user.isBlocking || user.isAttacking || user.attackCooldown || user.isShooting || user.isHitstun > 0) return;

    user.isShooting = true;
    user.ex -= 30;
    updateHealthBars();

    const wType = user.weaponType;
    const myEpoch = roundEpoch;
    const stillValid = () => gameRunning && !roundOver && myEpoch === roundEpoch;

    if (wType === "saber") {
        // Striker: Piercing Laser Blade Wave
        playSound('projectile');
        spawnDust(user.x + user.width / 2, arenaHeight - groundHeight);
        const pX = user.x + (user.facing === 1 ? user.width + 10 : -20);
        const pY = (arenaHeight - groundHeight) - user.y - user.height * 0.65;
        projectiles.push({
            x: pX, y: pY, vx: user.facing * 13, radius: 18,
            owner: user, color: user.lightColor, shadowColor: user.shadowColor,
            damage: 18, type: "wave"
        });
    } else if (wType === "greatsword") {
        // Titan: Ground Shockwave
        playSound('slash');
        screenShake = 12;
        spawnImpactDust(user.x + user.width / 2, arenaHeight - groundHeight, user.lightColor);
        const pX = user.x + (user.facing === 1 ? user.width + 10 : -30);
        const groundY = arenaHeight - groundHeight;
        projectiles.push({
            x: pX, y: groundY - 25, vx: user.facing * 7.5, radius: 24,
            owner: user, color: user.lightColor, shadowColor: user.shadowColor,
            damage: 22, type: "shockwave"
        });
    } else if (wType === "daggers") {
        // Shadow: Shadow Step (Teleport Behind + Critical Backstab)
        playSound('slash');
        spawnSparks(user.x + user.width / 2, (arenaHeight - groundHeight) - 50, user.color);
        user.x = target.x - user.facing * 65;
        limitPosition(user);
        user.facing = target.x >= user.x ? 1 : -1;
        spawnSparks(user.x + user.width / 2, (arenaHeight - groundHeight) - 50, user.lightColor);

        target.hp = Math.max(0, target.hp - 18);
        target.hitTimer = 16;
        target.isHitstun = 28;
        screenShake = 10;
        playSound('hit');
        triggerHitFlash();
        const dmgX = target.x + target.width / 2;
        const dmgY = (arenaHeight - groundHeight) - target.height * 0.6;
        damageNumbers.push(new DamageNumber(dmgX, dmgY, 18, true));
        spawnImpactDust(dmgX, arenaHeight - groundHeight, user.lightColor);
        updateHealthBars();
        checkWinner();
    } else if (wType === "staff") {
        // Mage: Triple Arcane Bolts (Burst of 3 magic orbs)
        spawnDust(user.x + user.width / 2, arenaHeight - groundHeight);
        for (let b = 0; b < 3; b++) {
            scheduleTimeout(() => {
                if (!stillValid()) return;
                const pX = user.x + (user.facing === 1 ? user.width + 10 : -20);
                const pY = (arenaHeight - groundHeight) - user.y - user.height * (0.45 + (b - 1) * 0.18);
                projectiles.push({
                    x: pX, y: pY, vx: user.facing * 10, radius: 10,
                    owner: user, color: user.lightColor, shadowColor: user.shadowColor,
                    damage: 8, type: "orb"
                });
                playSound('projectile');
            }, b * 100);
        }
    } else if (wType === "gauntlets") {
        // Wrestler: Power Tackle / Command Grab (Rush + slam through block)
        playSound('jump');
        user.velocityX = user.facing * 15;
        screenShake = 8;
        spawnDust(user.x + user.width / 2, arenaHeight - groundHeight);

        scheduleTimeout(() => {
            if (!stillValid()) return;
            const dist = getDistance(user, target);
            if (dist < 100) {
                target.hp = Math.max(0, target.hp - 24);
                target.isHitstun = 35;
                target.hitTimer = 18;
                target.y = 0;
                target.velocityY = 0;
                target.velocityX = user.facing * 8;
                playSound('hit');
                triggerHitFlash();
                screenShake = 18;
                const dmgX = target.x + target.width / 2;
                damageNumbers.push(new DamageNumber(dmgX, (arenaHeight - groundHeight) - 60, 24, true));
                spawnImpactDust(dmgX, arenaHeight - groundHeight, user.lightColor);
                updateHealthBars();
                checkWinner();
            }
        }, 120);
    } else if (wType === "claws") {
        // Assassin: Sonic Claw Dash (rapid slice through opponent + air launch)
        playSound('slash');
        user.velocityX = user.facing * 18;
        spawnImpactDust(user.x + user.width / 2, arenaHeight - groundHeight, user.lightColor);

        scheduleTimeout(() => {
            if (!stillValid()) return;
            const dist = getDistance(user, target);
            if (dist < 110) {
                target.hp = Math.max(0, target.hp - 20);
                target.hitTimer = 18;
                target.isHitstun = 24;
                target.isJuggling = true;
                target.juggleCount = 1;
                target.velocityY = 11;
                target.velocityX = user.facing * 4;
                playSound('hit');
                triggerHitFlash();
                screenShake = 12;
                const dmgX = target.x + target.width / 2;
                damageNumbers.push(new DamageNumber(dmgX, (arenaHeight - groundHeight) - 60, 20, true));
                spawnSparks(dmgX, (arenaHeight - groundHeight) - 50, user.lightColor);
                updateHealthBars();
                checkWinner();
            }
        }, 100);
    }

    scheduleTimeout(() => {
        if (!stillValid()) return;
        user.isShooting = false;
    }, 260);
}

function playerShoot() {
    executeExSkill(player, enemy);
}

function enemyShoot() {
    executeExSkill(enemy, player);
}

function getDistance(char1, char2) {
    const center1 = char1.x + char1.width / 2;
    const center2 = char2.x + char2.width / 2;
    return Math.abs(center1 - center2);
}

function isTargetInFront(attacker, target) {
    if (attacker.facing === 1) {
        return target.x > attacker.x;
    } else {
        return target.x < attacker.x;
    }
}

function limitPosition(character) {
    if (character.x < 0) {
        character.x = 0;
    }
    if (character.x + character.width > arenaWidth) {
        character.x = arenaWidth - character.width;
    }
}

function updateHealthBars() {
    // Smooth HP animation
    player.targetHp = player.hp;
    enemy.targetHp = enemy.hp;

    // HP
    const pMaxHp = CHARACTER_CLASSES[player.className].maxHp;
    const eMaxHp = CHARACTER_CLASSES[enemy.className].maxHp;

    // Animate displayed HP towards target
    if (!player.displayHp) player.displayHp = player.hp;
    if (!enemy.displayHp) enemy.displayHp = enemy.hp;

    // Snap to 0 immediately when dead (avoid visual desync)
    if (player.hp <= 0) player.displayHp = 0;
    if (enemy.hp <= 0) enemy.displayHp = 0;
    else {
        player.displayHp += (player.targetHp - player.displayHp) * 0.15;
        enemy.displayHp += (enemy.targetHp - enemy.displayHp) * 0.15;
    }

    const pHPPercent = Math.max(0, (player.displayHp / pMaxHp) * 100);
    const eHPPercent = Math.max(0, (enemy.displayHp / eMaxHp) * 100);

    playerHealthElement.style.width = pHPPercent + "%";
    enemyHealthElement.style.width = eHPPercent + "%";

    // Low HP warning pulse
    if (pHPPercent < 25) {
        playerHealthElement.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.8)";
        playerHealthElement.style.animation = "hpPulse 0.5s infinite";
    } else {
        playerHealthElement.style.boxShadow = "0 0 12px rgba(34, 197, 94, 0.5)";
        playerHealthElement.style.animation = "none";
    }
    if (eHPPercent < 25) {
        enemyHealthElement.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.8)";
        enemyHealthElement.style.animation = "hpPulse 0.5s infinite";
    } else {
        enemyHealthElement.style.boxShadow = "0 0 12px rgba(239, 68, 68, 0.5)";
        enemyHealthElement.style.animation = "none";
    }

    // EX Bars with smooth animation
    if (!player.displayEx) player.displayEx = player.ex;
    if (!enemy.displayEx) enemy.displayEx = enemy.ex;

    player.displayEx += (player.ex - player.displayEx) * 0.2;
    enemy.displayEx += (enemy.ex - enemy.displayEx) * 0.2;

    playerExElement.style.width = player.displayEx + "%";
    enemyExElement.style.width = enemy.displayEx + "%";

    // EX full glow
    if (player.displayEx >= 100) {
        playerExElement.style.boxShadow = "0 0 20px rgba(6, 182, 212, 1), 0 0 40px rgba(168, 85, 247, 0.5)";
    } else {
        playerExElement.style.boxShadow = "0 0 8px rgba(6, 182, 212, 0.6)";
    }
    if (enemy.displayEx >= 100) {
        enemyExElement.style.boxShadow = "0 0 20px rgba(249, 115, 22, 1), 0 0 40px rgba(168, 85, 247, 0.5)";
    } else {
        enemyExElement.style.boxShadow = "0 0 8px rgba(249, 115, 22, 0.6)";
    }

    // Class Names displays
    playerClassNameElement.textContent = CHARACTER_CLASSES[player.className].name;
    enemyClassNameElement.textContent = CHARACTER_CLASSES[enemy.className].name;
}

function showGameOver(message) {
    gameOverResult.textContent = message;
    if (message.includes("PLAYER")) {
        gameOverTitle.textContent = "VICTORY!";
        gameOverTitle.style.background = "linear-gradient(90deg, #60a5fa, #3b82f6, #2563eb)";
        gameOverTitle.style.webkitBackgroundClip = "text";
        gameOverTitle.style.webkitTextFillColor = "transparent";
        playSound('win');
        spawnVictoryBurst();
    } else {
        gameOverTitle.textContent = "DEFEAT";
        gameOverTitle.style.background = "linear-gradient(90deg, #ef4444, #dc2626, #b91c1c)";
        gameOverTitle.style.webkitBackgroundClip = "text";
        gameOverTitle.style.webkitTextFillColor = "transparent";
    }
    scheduleTimeout(() => {
        gameOverMenu.classList.remove("hidden");
        clearKeys();
    }, 1000);
}

function spawnVictoryBurst() {
    const centerX = arenaWidth / 2;
    const groundY = arenaHeight - groundHeight;
    for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 8;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 4;
        const size = 3 + Math.random() * 5;
        const life = 40 + Math.random() * 40;
        const color = Math.random() < 0.5 ? "#facc15" : "#60a5fa";
        particles.push(new Particle(centerX, groundY, color, vx, vy, size, life));
    }
}

function handleRoundEnd() {
    const playerWon = koSlowMoTarget === enemy;
    koSlowMoTarget = null;

    if (playerWon) {
        playerRoundsWon++;
    } else {
        enemyRoundsWon++;
    }
    updateRoundDots();

    const winnerLabel = playerWon 
        ? (gameMode === "1P" ? "PLAYER" : "PLAYER 1") 
        : (gameMode === "1P" ? "ENEMY" : "PLAYER 2");

    if (playerRoundsWon >= 2 || enemyRoundsWon >= 2) {
        const msg = `${winnerLabel} WINS MATCH!`;
        setStatus(msg, 0);
        showGameOver(msg);
    } else {
        const msg = `${winnerLabel} WINS ROUND ${currentRound}!`;
        setStatus(msg, 1500);
        scheduleTimeout(() => {
            startNextRound();
        }, 1500);
    }
}

function startNextRound() {
    currentRound++;
    roundEpoch++;
    clearAllTimeouts();

    player.hp = player.maxHp;
    player.targetHp = player.maxHp;
    player.displayHp = player.maxHp;
    player.ex = 0;
    player.displayEx = 0;
    enemy.hp = enemy.maxHp;
    enemy.targetHp = enemy.maxHp;
    enemy.displayHp = enemy.maxHp;
    enemy.ex = 0;
    enemy.displayEx = 0;

    player.x = 120;
    player.y = 0;
    player.velocityX = 0;
    player.velocityY = 0;
    player.facing = 1;
    player.isHitstun = 0;
    player.isJuggling = false;
    player.juggleCount = 0;
    player.isBlocking = false;
    player.blockHoldTime = 0;
    player.isAttacking = false;
    player.isShooting = false;
    player.isJumping = false;
    player.attackCooldown = false;
    player.hitTimer = 0;
    player.landingRecovery = 0;
    player.swordTrail = [];
    player.isMoving = false;

    enemy.x = arenaWidth - 160;
    enemy.y = 0;
    enemy.velocityX = 0;
    enemy.velocityY = 0;
    enemy.facing = -1;
    enemy.isHitstun = 0;
    enemy.isJuggling = false;
    enemy.juggleCount = 0;
    enemy.isBlocking = false;
    enemy.blockHoldTime = 0;
    enemy.isAttacking = false;
    enemy.isShooting = false;
    enemy.isJumping = false;
    enemy.attackCooldown = false;
    enemy.blockingTimer = 0;
    enemy.hitTimer = 0;
    enemy.landingRecovery = 0;
    enemy.swordTrail = [];
    enemy.isMoving = false;
    enemy.aiState = "chase";
    enemy.aiStateTimer = 0;

    projectiles = [];
    particles = [];
    damageNumbers = [];
    hitStopFrames = 0;
    screenShake = 0;
    roundOver = false;
    roundTimer = settings.roundTime;

    updateHealthBars();
    startRoundTimer();

    startCountdown(() => {
        gameRunning = true;
    }, `ROUND ${currentRound}`);
}

function updateTimerDisplay() {
    if (!timerDisplay) return;
    timerDisplay.textContent = roundTimer;
    timerDisplay.classList.toggle("timer-low", roundTimer <= 10);
}

function startRoundTimer() {
    if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
    updateTimerDisplay();
    roundTimerInterval = setInterval(() => {
        if (gameRunning && !roundOver && !isPaused && !isCountingDown && roundTimer > 0) {
            roundTimer--;
            updateTimerDisplay();
            if (roundTimer <= 0) checkWinner();
        }
    }, 1000);
}

function checkWinner() {
    if (roundOver) return;
    if (enemy.hp <= 0) {
        gameRunning = false;
        roundOver = true;
        if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
        koSlowMo = 80;
        koSlowMoTarget = enemy;
        screenShake = 20;
        hitStopFrames = 30;
    } else if (player.hp <= 0) {
        gameRunning = false;
        roundOver = true;
        if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
        koSlowMo = 80;
        koSlowMoTarget = player;
        screenShake = 20;
        hitStopFrames = 30;
    } else if (roundTimer <= 0) {
        gameRunning = false;
        roundOver = true;
        if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
        koSlowMoTarget = player.hp >= enemy.hp ? enemy : player;
        handleRoundEnd();
    }
}

function updateSwordTrail(char) {
    const groundY = arenaHeight - groundHeight;
    const centerX = char.x + char.width / 2;
    const bottomY = groundY - char.y;

    const armLength = 25;
    const handleLength = 8;
    const bladeLength = char.bladeLength;

    let angle = 0.3;
    if (char.isAttacking) {
        const attackProgress = Math.max(0, Math.min(1, (Date.now() - char.attackStartTime) / 180));
        const easedAttack = attackProgress * attackProgress * (3 - 2 * attackProgress);
        angle = -0.8 + easedAttack * 2.5;
    } else if (char.isBlocking) {
        angle = -1.2;
    } else if (char.isHitstun > 0) {
        angle = 0.8;
    } else {
        angle = 0.3 + Math.sin(char.animTime) * (char.isMoving ? 0.2 : 0.06);
    }

    if (char.isAttacking) {
        const shoulderY = -88;
        const handX = 4 + Math.cos(angle) * armLength;
        const handY = shoulderY + Math.sin(angle) * armLength;

        const hx_local = handX + Math.cos(angle) * handleLength;
        const hy_local = handY + Math.sin(angle) * handleLength;

        const bx_local = hx_local + Math.cos(angle) * bladeLength;
        const by_local = hy_local + Math.sin(angle) * bladeLength;

        const hx_world = centerX + hx_local * char.facing;
        const hy_world = bottomY + hy_local;

        const bx_world = centerX + bx_local * char.facing;
        const by_world = bottomY + by_local;

        char.swordTrail.push({ hx: hx_world, hy: hy_world, bx: bx_world, by: by_world });
        if (char.swordTrail.length > 5) {
            char.swordTrail.shift();
        }
    } else {
        if (char.swordTrail.length > 0) {
            char.swordTrail.shift();
        }
    }
}

function drawSwordTrail(char, isPlayer) {
    if (char.swordTrail.length < 2) return;

    ctx.save();
    const color = isPlayer ? "rgba(96, 165, 250, " : "rgba(248, 113, 113, ";

    ctx.shadowBlur = 8;
    ctx.shadowColor = char.lightColor;

    for (let i = 0; i < char.swordTrail.length - 1; i++) {
        const p1 = char.swordTrail[i];
        const p2 = char.swordTrail[i + 1];

        const alpha = (i / char.swordTrail.length) * 0.35;

        ctx.beginPath();
        ctx.moveTo(p1.hx, p1.hy);
        ctx.lineTo(p1.bx, p1.by);
        ctx.lineTo(p2.bx, p2.by);
        ctx.lineTo(p2.hx, p2.hy);
        ctx.closePath();

        ctx.fillStyle = color + alpha + ")";
        ctx.fill();
    }
    ctx.restore();
}

function drawBackground() {
    const stage = STAGES[selectedStage];
    const groundY = arenaHeight - groundHeight;

    // Background sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, arenaHeight);
    stage.skyColors.forEach((color, i) => {
        skyGrad.addColorStop(i / (stage.skyColors.length - 1), color);
    });
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, arenaWidth, arenaHeight);

    // Parallax background layers
    bgAnimTime += 0.008;
    stage.parallaxLayers.forEach(layer => {
        const layerY = arenaHeight * layer.yStart + Math.sin(bgAnimTime * layer.speed + layer.yStart * 10) * 30;
        const layerGrad = ctx.createRadialGradient(
            arenaWidth / 2, layerY, 0,
            arenaWidth / 2, layerY, arenaWidth * 0.8
        );
        layerGrad.addColorStop(0, layer.color);
        layerGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = layerGrad;
        ctx.fillRect(0, 0, arenaWidth, arenaHeight);
    });

    // Background grid lines
    ctx.save();
    ctx.strokeStyle = stage.gridColor;
    ctx.lineWidth = 1;

    for (let y = 60; y < groundY; y += 45) {
        const offset = Math.sin(bgAnimTime * 0.5 + y * 0.02) * 5;
        ctx.beginPath();
        ctx.moveTo(0, y + offset);
        ctx.lineTo(arenaWidth, y + offset);
        ctx.stroke();
    }

    // Stage name watermark
    ctx.font = "bold 28px Orbitron";
    ctx.fillStyle = stage.neonColor + "33"; // 20% opacity
    ctx.textAlign = "center";
    ctx.fillText(stage.name, arenaWidth / 2, 70);

    // Ambient particles
    if (Math.random() < 0.03 * stage.ambientParticles.count) {
        const x = Math.random() * arenaWidth;
        const y = Math.random() * (groundY - 50);
        const size = 1 + Math.random() * 2;
        const life = 60 + Math.random() * 60;
        particles.push(new Particle(x, y, stage.ambientParticles.color, 0, -0.2, size, life));
    }

    // Ground
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, arenaHeight);
    groundGrad.addColorStop(0, stage.groundColor);
    groundGrad.addColorStop(1, "#070b12");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, arenaWidth, groundHeight);

    // Neon ground line
    ctx.strokeStyle = stage.neonColor;
    ctx.shadowBlur = 12;
    ctx.shadowColor = stage.neonColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(arenaWidth, groundY);
    ctx.stroke();

    // Perspective lines
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stage.neonColor + "33";
    ctx.lineWidth = 1;
    const gridSpacing = 60;
    for (let x = -120; x < arenaWidth + 120; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x - 40, arenaHeight);
        ctx.stroke();
    }

    ctx.restore();
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx;

        // Boundaries delete
        if (p.x < -40 || p.x > arenaWidth + 40) {
            projectiles.splice(i, 1);
            continue;
        }

        // Target checks
        const target = (p.owner === player) ? enemy : player;
        const groundY = arenaHeight - groundHeight;

        const targetLeft = target.x;
        const targetRight = target.x + target.width;
        const targetBottom = groundY - target.y;
        const targetTop = targetBottom - target.height;

        // Collision check
        if (p.x + p.radius > targetLeft && p.x - p.radius < targetRight &&
            p.y + p.radius > targetTop && p.y - p.radius < targetBottom) {

            const dmg = p.damage || 12;

            if (target.isBlocking && target.facing === -p.owner.facing) {
                // Blocked!
                const chipDmg = p.type === "shockwave" ? 4 : 1;
                target.hp -= chipDmg;
                target.hp = Math.max(target.hp, 0);
                target.ex = Math.min(100, target.ex + 10);

                const pushForce = p.type === "shockwave" ? 14 : 8;
                target.velocityX += p.owner.facing * pushForce / (target.knockbackResistance || 1);
                playSound('block');

                // Yellow block sparks
                spawnSparks(p.x, p.y, "#facc15");
                spawnImpactDust(p.x, p.y, "#facc15");
            } else {
                // Hit! - apply juggle physics
                target.hp -= dmg;
                target.hp = Math.max(target.hp, 0);
                target.hitTimer = 14;

                const kbResist = target.knockbackResistance || 1;
                const baseKnockbackX = (p.type === "shockwave" ? 9 : 6) / kbResist;
                const baseKnockbackY = (p.type === "shockwave" ? 11 : 9) / kbResist;

                const wasGrounded = target.y <= 0;
                const isJuggle = target.isJuggling || (!wasGrounded && target.juggleCount < 3);

                if (isJuggle || !wasGrounded) {
                    target.isJuggling = true;
                    target.juggleCount++;
                    target.velocityY = baseKnockbackY * (1.1 - target.juggleCount * 0.15);
                    target.velocityX += p.owner.facing * baseKnockbackX * 0.7;
                    target.isHitstun = 18 + target.juggleCount * 2;
                    hitStopFrames = 6;
                    screenShake = 10;
                } else {
                    target.velocityX += p.owner.facing * baseKnockbackX * 1.3;
                    target.velocityY = baseKnockbackY * 0.5;
                    target.isHitstun = 15;
                    hitStopFrames = 5;
                    screenShake = 8;
                    target.isJuggling = true;
                    target.juggleCount = 1;
                }

                p.owner.ex = Math.min(100, p.owner.ex + 15);
                target.ex = Math.min(100, target.ex + 6);

                playSound('hit');
                triggerHitFlash();

                // Damage number popup
                const isCrit = target.isJuggling;
                damageNumbers.push(new DamageNumber(p.x, p.y, dmg, isCrit));

                spawnSparks(p.x, p.y, target.lightColor);
                spawnImpactDust(p.x, p.y, target.lightColor);
            }

            updateHealthBars();
            checkWinner();
            projectiles.splice(i, 1);
        }
    }
}

function drawProjectiles() {
    for (const p of projectiles) {
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = p.shadowColor || p.color;

        if (p.type === "shockwave") {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            const h = p.radius * 1.8;
            ctx.moveTo(p.x, p.y + h / 2);
            ctx.lineTo(p.x + (p.vx > 0 ? 16 : -16), p.y - h / 2);
            ctx.lineTo(p.x, p.y - h * 0.4);
            ctx.lineTo(p.x - (p.vx > 0 ? 10 : -10), p.y + h / 2);
            ctx.closePath();
            ctx.fill();
        } else if (p.type === "wave") {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 5;
            ctx.beginPath();
            const startA = p.vx > 0 ? -Math.PI * 0.45 : Math.PI * 0.55;
            const endA = p.vx > 0 ? Math.PI * 0.45 : Math.PI * 1.45;
            ctx.arc(p.x, p.y, p.radius, startA, endA);
            ctx.stroke();

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 0.7, startA, endA);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();

            // Inner core
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
        }
        ctx.restore();
    }
}

function drawFighter(char, isPlayer, overrideCenterX = null) {
    const groundY = arenaHeight - groundHeight;
    const bottomY = groundY - char.y;
    const centerX = overrideCenterX != null ? overrideCenterX : char.x + char.width / 2;
    const armLength = 25;

    ctx.save();
    ctx.translate(centerX, bottomY);
    ctx.scale(char.facing, 1);

    const primaryColor = char.color;
    const lightColor = char.lightColor;
    const shadowColor = char.shadowColor;
    const isGrounded = char.y <= 0;
    const walkBob = (char.isMoving && isGrounded) ? -Math.abs(Math.sin(char.animTime)) * 2.5 : 0;
    const landingSquash = (char.landingRecovery > 0) ? char.landingRecovery * 1.5 : 0;
    const idleBreath = isGrounded && !char.isMoving ? Math.sin(char.animTime) * 1.8 : 0;
    const recoil = char.isHitstun > 0 ? 5 : 0;
    ctx.translate(-char.facing * recoil, idleBreath + walkBob + landingSquash);

    ctx.lineWidth = char.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = primaryColor;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = char.hitTimer > 0 ? 22 : 15;

    // 1. Draw energy shield if blocking
    if (char.isBlocking) {
        ctx.save();
        ctx.lineWidth = 4;
        const isCrushWarning = (char.blockHoldTime || 0) > 120;
        const shieldColor = isCrushWarning ? "#ef4444" : lightColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = isCrushWarning ? "#ef4444" : shadowColor;
        ctx.strokeStyle = shieldColor;

        const shieldRadius = char.height * 0.55;
        const shieldGrad = ctx.createRadialGradient(0, -char.height / 2, 10, 0, -char.height / 2, shieldRadius);
        shieldGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        shieldGrad.addColorStop(1, isCrushWarning ? "rgba(239, 68, 68, 0.35)" : (isPlayer ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)"));
        ctx.fillStyle = shieldGrad;

        ctx.beginPath();
        ctx.arc(0, -char.height / 2, shieldRadius, -Math.PI * 0.65, Math.PI * 0.65);
        ctx.lineTo(0, -char.height / 2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, -char.height / 2, shieldRadius, -Math.PI * 0.65, Math.PI * 0.65);
        ctx.stroke();
        ctx.restore();
    }

    const headRadius = 15;
    const neckY = -char.height + 2 * headRadius + 4;
    const pelvisY = -45;
    const shoulderY = neckY + 8;

    // A. Head (Hollow circle)
    ctx.beginPath();
    ctx.arc(0, -char.height + headRadius + 4, headRadius, 0, Math.PI * 2);
    ctx.stroke();

    // B. Spine
    ctx.beginPath();
    ctx.moveTo(0, neckY);
    ctx.lineTo(0, pelvisY);
    ctx.stroke();

    // C. Legs
    let leftLegX = -12;
    let rightLegX = 12;
    let leftLegY = 0;
    let rightLegY = 0;

    if (char.isAttacking) {
        leftLegX = -18;
        rightLegX = 16;
        leftLegY = -3;
        rightLegY = 0;
    } else if (char.isHitstun > 0) {
        leftLegX = -19;
        rightLegX = 18;
        leftLegY = -4;
        rightLegY = -2;
    } else if (char.isJumping || char.y > 0) {
        leftLegX = -8;
        rightLegX = 8;
        leftLegY = -12;
        rightLegY = -12;
    } else if (char.isBlocking) {
        leftLegX = -14;
        rightLegX = 10;
        leftLegY = -6;
        rightLegY = -6;
    } else if (char.isMoving) {
        const cycle = char.animTime;
        const swing = Math.sin(cycle);
        leftLegX = -12 - swing * 15;
        rightLegX = 12 + swing * 15;
        // Alternating 180-deg phase foot step lift
        leftLegY = swing > 0 ? -swing * 9 : 0;
        rightLegY = swing < 0 ? swing * 9 : 0;
    }

    // Draw Left Leg
    ctx.beginPath();
    ctx.moveTo(-3, pelvisY);
    ctx.lineTo(leftLegX, leftLegY);
    ctx.stroke();

    // Draw Right Leg
    ctx.beginPath();
    ctx.moveTo(3, pelvisY);
    ctx.lineTo(rightLegX, rightLegY);
    ctx.stroke();

    // D. Back Arm (Left Arm) & Off-hand weapons
    if (char.weaponType === "daggers") {
        // Shadow: Left reverse dagger
        const leftArmAngle = char.isBlocking ? 0.5 : (char.isShooting ? 0 : -1.8 + (char.isMoving ? Math.sin(char.animTime) * 0.3 : 0));
        const armLen = armLength - 4;
        const lhx = -4 + Math.cos(leftArmAngle) * armLen;
        const lhy = shoulderY + Math.sin(leftArmAngle) * armLen;

        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(lhx, lhy);
        ctx.stroke();

        const lbx = lhx + Math.cos(leftArmAngle) * 22;
        const lby = lhy + Math.sin(leftArmAngle) * 22;

        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lhx, lhy);
        ctx.lineTo(lbx, lby);
        ctx.stroke();
        ctx.restore();
    } else if (char.weaponType === "claws") {
        // Assassin: Left claw arm
        const leftArmAngle = char.isBlocking ? -0.8 : (char.isAttacking ? 0.2 : -1.4 + Math.sin(char.animTime) * 0.2);
        const armLen = armLength - 3;
        const lhx = -4 + Math.cos(leftArmAngle) * armLen;
        const lhy = shoulderY + Math.sin(leftArmAngle) * armLen;

        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(lhx, lhy);
        ctx.stroke();

        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.5;
        [-0.18, 0, 0.18].forEach(spread => {
            const cx = lhx + Math.cos(leftArmAngle + spread) * 20;
            const cy = lhy + Math.sin(leftArmAngle + spread) * 20;
            ctx.beginPath();
            ctx.moveTo(lhx, lhy);
            ctx.lineTo(cx, cy);
            ctx.stroke();
        });
        ctx.restore();
    } else if (char.weaponType === "gauntlets") {
        // Wrestler: Left armored power fist
        const leftArmAngle = char.isBlocking ? -1.0 : (char.isAttacking ? 0.1 : -0.6 + Math.sin(char.animTime) * 0.2);
        const armLen = armLength;
        const lhx = -4 + Math.cos(leftArmAngle) * armLen;
        const lhy = shoulderY + Math.sin(leftArmAngle) * armLen;

        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(lhx, lhy);
        ctx.stroke();

        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.fillStyle = shadowColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(lhx, lhy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        [-0.2, 0.2].forEach(spread => {
            ctx.beginPath();
            ctx.moveTo(lhx, lhy);
            ctx.lineTo(lhx + Math.cos(leftArmAngle + spread) * 14, lhy + Math.sin(leftArmAngle + spread) * 14);
            ctx.stroke();
        });
        ctx.restore();
    } else {
        // Striker, Titan & Mage standard back arm
        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        if (char.isBlocking) {
            ctx.lineTo(10, -75);
        } else if (char.isShooting) {
            ctx.lineTo(25, shoulderY);
        } else if (char.isMoving) {
            ctx.lineTo(-12 + Math.sin(char.animTime) * 6, -70);
        } else {
            ctx.lineTo(-12, -72);
        }
        ctx.stroke();
    }

    // E. Front Arm (Right Arm)
    let armAngle = 0.3;
    if (char.isShooting) {
        armAngle = 0; // Extended straight forward
    } else if (char.isAttacking) {
        const attackProgress = Math.max(0, Math.min(1, (Date.now() - char.attackStartTime) / 180));
        const easedAttack = attackProgress * attackProgress * (3 - 2 * attackProgress);
        armAngle = -0.8 + easedAttack * 2.5;
    } else if (char.isBlocking) {
        armAngle = -1.2;
    } else if (char.isMoving) {
        armAngle = 0.3 + Math.sin(char.animTime) * 0.2;
    }

    const handX = 4 + Math.cos(armAngle) * armLength;
    const handY = shoulderY + Math.sin(armAngle) * armLength;

    // Draw Front Arm
    ctx.beginPath();
    ctx.moveTo(4, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // F. Main Weapon based on weaponType
    const handleLength = 8;
    const hx = handX + Math.cos(armAngle) * handleLength;
    const hy = handY + Math.sin(armAngle) * handleLength;
    const bx = hx + Math.cos(armAngle) * char.bladeLength;
    const by = hy + Math.sin(armAngle) * char.bladeLength;

    if (char.weaponType === "gauntlets") {
        // Wrestler: Heavy Power Gauntlet
        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.fillStyle = shadowColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.arc(handX, handY, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        [-0.25, 0, 0.25].forEach(spread => {
            const sx = handX + Math.cos(armAngle + spread) * 18;
            const sy = handY + Math.sin(armAngle + spread) * 18;
            ctx.beginPath();
            ctx.moveTo(handX, handY);
            ctx.lineTo(sx, sy);
            ctx.stroke();
        });
        ctx.restore();
    } else if (char.weaponType === "claws") {
        // Assassin: 3-Pronged Razor Claws
        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3;

        [-0.2, 0, 0.2].forEach(spread => {
            const cx = handX + Math.cos(armAngle + spread) * char.bladeLength;
            const cy = handY + Math.sin(armAngle + spread) * char.bladeLength;
            ctx.beginPath();
            ctx.moveTo(handX, handY);
            ctx.lineTo(cx, cy);
            ctx.stroke();
        });
        ctx.restore();
    } else if (char.weaponType === "staff") {
        // Mage: Arcane Staff with Magic Orb
        const backX = handX - Math.cos(armAngle) * 22;
        const backY = handY - Math.sin(armAngle) * 22;

        ctx.save();
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(backX, backY);
        ctx.lineTo(bx, by);
        ctx.stroke();

        ctx.strokeStyle = lightColor;
        ctx.fillStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    } else {
        // Striker (saber), Titan (greatsword), Shadow (daggers)
        if (char.weaponType === "greatsword") {
            const guardLength = 12;
            const gx1 = hx + Math.cos(armAngle + Math.PI / 2) * guardLength;
            const gy1 = hy + Math.sin(armAngle + Math.PI / 2) * guardLength;
            const gx2 = hx - Math.cos(armAngle + Math.PI / 2) * guardLength;
            const gy2 = hy - Math.sin(armAngle + Math.PI / 2) * guardLength;

            ctx.save();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "#9ca3af";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(gx1, gy1);
            ctx.lineTo(gx2, gy2);
            ctx.stroke();
            ctx.restore();
        }

        // Draw Handle
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = char.lineWidth - 1;
        ctx.beginPath();
        ctx.moveTo(handX, handY);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.restore();

        // Draw Main Blade
        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 18;
        ctx.lineWidth = char.lineWidth;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}

function render() {
    // 1. Clear Canvas
    ctx.clearRect(0, 0, arenaWidth, arenaHeight);
    ctx.save();
    if (screenShake > 0) {
        if (settings.screenShake) {
            ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        }
        screenShake *= 0.78;
        if (screenShake < 0.4) screenShake = 0;
    }

    // 2. Draw Background & Ground
    drawBackground();

    // 3. Update Sword Trails
    updateSwordTrail(player);
    updateSwordTrail(enemy);

    // 4. Draw Trails
    drawSwordTrail(player, true);
    drawSwordTrail(enemy, false);

    // 5. Draw Projectiles
    drawProjectiles();

    // 6. Draw Fighters (using procedural drawing)
    drawFighter(player, true);
    drawFighter(enemy, false);

    // 7. Update and Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        } else {
            particles[i].draw();
        }
    }

    // 8. Update and Draw Damage Numbers
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        damageNumbers[i].update();
        if (damageNumbers[i].life <= 0) {
            damageNumbers.splice(i, 1);
        } else {
            damageNumbers[i].draw();
        }
    }
    ctx.restore();
}

function gameLoop() {
    // Poll gamepads
    pollGamepads();

    // Update keys from gamepad input
    if (!inMainMenu && !isPaused && !isCountingDown) {
        const gp0 = getGamepadInput(0);
        const gp1 = getGamepadInput(1);

        if (gp0) {
            // Player 1 gamepad
            if (gp0.left) keys['a'] = true; else keys['a'] = false;
            if (gp0.right) keys['d'] = true; else keys['d'] = false;
            if (gp0.up) keys['w'] = true; else keys['w'] = false;
            if (gp0.down) keys['s'] = true; else keys['s'] = false;
            if (gp0.attack) { keys['j'] = true; setTimeout(() => keys['j'] = false, 0); }
            if (gp0.special) { keys['k'] = true; setTimeout(() => keys['k'] = false, 0); }
            if (gp0.pause) { togglePause(); }
            if (gp0.restart) { restartGame(); }
        }

        if (gp1 && gameMode === "2P") {
            // Player 2 gamepad
            if (gp1.left) keys['arrowleft'] = true; else keys['arrowleft'] = false;
            if (gp1.right) keys['arrowright'] = true; else keys['arrowright'] = false;
            if (gp1.up) keys['arrowup'] = true; else keys['arrowup'] = false;
            if (gp1.down) keys['arrowdown'] = true; else keys['arrowdown'] = false;
            if (gp1.attack) { keys['0'] = true; setTimeout(() => keys['0'] = false, 0); }
            if (gp1.special) { keys['1'] = true; setTimeout(() => keys['1'] = false, 0); }
            if (gp1.pause) { togglePause(); }
            if (gp1.restart) { restartGame(); }
        }
    }

    // KO Slow-mo handling
    if (koSlowMo > 0) {
        koSlowMo--;
        if (koSlowMo <= 0 && koSlowMoTarget) {
            handleRoundEnd();
        }
    }

    if (!inMainMenu && !isPaused && !isCountingDown) {
        if (hitStopFrames > 0) {
            hitStopFrames--;
        } else {
            updatePlayerMovement();
            if (gameMode === "1P") {
                updateEnemyAI();
            } else {
                updateEnemyPlayerMovement();
            }
            updateProjectiles();
        }
    }

    // Update Hit Flashing Timer
    if (player.hitTimer > 0) player.hitTimer--;
    if (enemy.hitTimer > 0) enemy.hitTimer--;

    render();
    requestAnimationFrame(gameLoop);
}

function restartGame() {
    // Reset match rounds
    playerRoundsWon = 0;
    enemyRoundsWon = 0;
    currentRound = 1;
    roundEpoch++;
    clearAllTimeouts();
    updateRoundDots();

    // Assign classes
    applyClassStats(player, selectedPlayerClass);

    // Assign enemy class berdasarkan mode
    if (gameMode === "1P") {
        const classes = Object.keys(CHARACTER_CLASSES);
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        applyClassStats(enemy, randomClass);
    } else {
        applyClassStats(enemy, selectedEnemyClass);
    }

    player.x = 120;
    player.y = 0;
    player.velocityX = 0;
    player.velocityY = 0;
    player.hp = player.maxHp;
    player.targetHp = player.maxHp;
    player.displayHp = player.maxHp;
    player.ex = 0;
    player.displayEx = 0;
    player.facing = 1;
    player.isJumping = false;
    player.isAttacking = false;
    player.attackCooldown = false;
    player.isBlocking = false;
    player.blockHoldTime = 0;
    player.isShooting = false;
    player.hitTimer = 0;
    player.isHitstun = 0;
    player.isJuggling = false;
    player.juggleCount = 0;
    player.animTime = 0;
    player.landingRecovery = 0;
    player.swordTrail = [];
    player.isMoving = false;

    // Recalculate dimensions
    resizeCanvas();

    enemy.x = arenaWidth - 160;
    enemy.y = 0;
    enemy.velocityX = 0;
    enemy.velocityY = 0;
    enemy.hp = enemy.maxHp;
    enemy.targetHp = enemy.maxHp;
    enemy.displayHp = enemy.maxHp;
    enemy.ex = 0;
    enemy.displayEx = 0;
    enemy.facing = -1;
    enemy.isJumping = false;
    enemy.isAttacking = false;
    enemy.attackCooldown = false;
    enemy.isBlocking = false;
    enemy.blockHoldTime = 0;
    enemy.isShooting = false;
    enemy.hitTimer = 0;
    enemy.isHitstun = 0;
    enemy.isJuggling = false;
    enemy.juggleCount = 0;
    enemy.animTime = 0;
    enemy.landingRecovery = 0;
    enemy.blockingTimer = 0;
    enemy.swordTrail = [];
    enemy.isMoving = false;
    enemy.aiState = "chase";
    enemy.aiStateTimer = 0;

    projectiles = [];
    particles = [];
    damageNumbers = [];
    hitStopFrames = 0;
    screenShake = 0;
    roundOver = false;
    roundTimer = settings.roundTime;
    koSlowMo = 0;
    koSlowMoTarget = null;
    clearStatus();
    startRoundTimer();

    gameRunning = true;

    updateHealthBars();

    if (!inMainMenu) {
        startCountdown(() => { gameRunning = true; }, "ROUND 1");
    }
}

// Start Loops
applySettings();
syncSettingsUI();
restartGame();
gameLoop();