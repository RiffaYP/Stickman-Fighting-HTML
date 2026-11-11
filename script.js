const arena = document.getElementById("arena");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const playerHealthElement = document.getElementById("playerHealth");
const enemyHealthElement = document.getElementById("enemyHealth");
const playerExElement = document.getElementById("playerEx");
const enemyExElement = document.getElementById("enemyEx");
const playerClassNameElement = document.getElementById("playerClassName");
const enemyClassNameElement = document.getElementById("enemyClassName");
const statusText = document.getElementById("statusText");
const hitFlashElement = document.getElementById("hitFlash");

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

const keys = {};

const groundHeight = 45;
const gravity = 0.95;
const airDrag = 0.97;
const groundFriction = 0.85;

// Game states
let gameRunning = false;
let inMainMenu = true;
let isPaused = false;
let isCountingDown = false;
let gameMode = "1P"; // "1P" atau "2P"
let selectingPlayer = 1; // 1 atau 2
let selectedEnemyClass = "striker";
let selectedStage = "neon"; // default stage

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

// Asset Pipeline
class AssetManager {
    constructor() {
        this.images = new Map();
        this.audio = new Map();
        this.spriteAtlases = new Map();
        this.loadingQueue = [];
        this.loadedCount = 0;
        this.totalCount = 0;
        this.onProgress = null;
        this.onComplete = null;
    }

    // Load single image
    loadImage(key, url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.images.set(key, img);
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // Load sprite atlas (image + JSON metadata)
    loadSpriteAtlas(key, imageUrl, jsonUrl) {
        return Promise.all([
            this.loadImage(key, imageUrl),
            fetch(jsonUrl).then(r => r.json())
        ]).then(([img, metadata]) => {
            this.spriteAtlases.set(key, { image: img, metadata });
            return { image: img, metadata };
        });
    }

    // Load audio file
    loadAudio(key, url) {
        return fetch(url)
            .then(r => r.arrayBuffer())
            .then(data => audioCtx.decodeAudioData(data))
            .then(buffer => {
                this.audio.set(key, buffer);
                return buffer;
            });
    }

    // Load audio sprite (single file with multiple sounds + JSON timing)
    loadAudioSprite(key, audioUrl, jsonUrl) {
        return Promise.all([
            this.loadAudio(key + '_buffer', audioUrl),
            fetch(jsonUrl).then(r => r.json())
        ]).then(([buffer, metadata]) => {
            this.audio.set(key, { buffer, metadata });
            return { buffer, metadata };
        });
    }

    // Batch load multiple assets
    loadManifest(manifest) {
        this.loadingQueue = manifest;
        this.totalCount = manifest.length;
        this.loadedCount = 0;

        const promises = manifest.map(asset => {
            let promise;
            switch (asset.type) {
                case 'image':
                    promise = this.loadImage(asset.key, asset.url);
                    break;
                case 'atlas':
                    promise = this.loadSpriteAtlas(asset.key, asset.imageUrl, asset.jsonUrl);
                    break;
                case 'audio':
                    promise = this.loadAudio(asset.key, asset.url);
                    break;
                case 'audioSprite':
                    promise = this.loadAudioSprite(asset.key, asset.audioUrl, asset.jsonUrl);
                    break;
            }
            return promise.then(() => {
                this.loadedCount++;
                if (this.onProgress) this.onProgress(this.loadedCount, this.totalCount, asset.key);
            });
        });

        return Promise.all(promises).then(() => {
            if (this.onComplete) this.onComplete();
        });
    }

    getImage(key) { return this.images.get(key); }
    getAudio(key) { return this.audio.get(key); }
    getAtlas(key) { return this.spriteAtlases.get(key); }

    // Play audio sprite
    playAudioSprite(key, spriteName, volume = 1.0) {
        const asset = this.audio.get(key);
        if (!asset || !asset.metadata) return;

        const sprite = asset.metadata.sprites[spriteName];
        if (!sprite) return;

        const source = audioCtx.createBufferSource();
        source.buffer = asset.buffer;
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = volume;
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        source.start(0, sprite.start, sprite.duration);
        return source;
    }

    // Draw sprite from atlas
    drawSprite(ctx, atlasKey, spriteName, x, y, w, h, flipped = false) {
        const atlas = this.spriteAtlases.get(atlasKey);
        if (!atlas) return;

        const sprite = atlas.metadata.frames[spriteName];
        if (!sprite) return;

        ctx.save();
        if (flipped) {
            ctx.scale(-1, 1);
            ctx.drawImage(
                atlas.image,
                sprite.x, sprite.y, sprite.w, sprite.h,
                -x - w, y, w, h
            );
        } else {
            ctx.drawImage(
                atlas.image,
                sprite.x, sprite.y, sprite.w, sprite.h,
                x, y, w, h
            );
        }
        ctx.restore();
    }
}

const assetManager = new AssetManager();

// Preload essential assets on first interaction
function preloadAssets() {
    // Example manifest - replace with actual asset URLs when available
    const manifest = [
        // { type: 'image', key: 'bg_neon', url: 'assets/bg_neon.png' },
        // { type: 'atlas', key: 'striker', imageUrl: 'assets/striker.png', jsonUrl: 'assets/striker.json' },
        // { type: 'audio', key: 'hit', url: 'assets/hit.ogg' },
        // { type: 'audioSprite', key: 'sfx', audioUrl: 'assets/sfx.ogg', jsonUrl: 'assets/sfx.json' }
    ];

    if (manifest.length > 0) {
        assetManager.onProgress = (loaded, total, key) => {
            console.log(`Loading: ${key} (${loaded}/${total})`);
        };
        assetManager.onComplete = () => {
            console.log('All assets loaded!');
        };
        assetManager.loadManifest(manifest);
    }
}

// Initialize asset loading on first user interaction
document.addEventListener('click', () => {
    preloadAssets();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });

// Audio Synthesizer (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    if (type === 'slash') {
        // Laser blade swing: triangle pitch sweep + quick decay
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

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
        gainNode.connect(audioCtx.destination);

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
        gainNode.connect(audioCtx.destination);

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
        gainNode.connect(audioCtx.destination);

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
        gainNode.connect(audioCtx.destination);

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
            gainNode.connect(audioCtx.destination);

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
    if (hitFlashElement) {
        hitFlashElement.classList.remove("active");
        hitFlashElement.offsetWidth;
        hitFlashElement.classList.add("active");
    }
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

const SPRITE_ANIMATIONS = {
    idle: { frames: 4, frameRate: 8 },
    run: { frames: 6, frameRate: 12 },
    jump: { frames: 3, frameRate: 10 },
    attack: { frames: 4, frameRate: 15 },
    hit: { frames: 2, frameRate: 20 },
    block: { frames: 2, frameRate: 8 },
    shoot: { frames: 3, frameRate: 12 },
    death: { frames: 4, frameRate: 6 }
};

function createProceduralSpriteSheet(char) {
    // Creates procedural animated sprites as offscreen canvases
    const sheet = {};
    const w = char.width;
    const h = char.height;
    const primaryColor = char.color;
    const lightColor = char.lightColor;
    const shadowColor = char.shadowColor;
    const weaponType = char.weaponType;

    // Create a canvas for each animation state
    Object.keys(SPRITE_ANIMATIONS).forEach(state => {
        const anim = SPRITE_ANIMATIONS[state];
        const canvas = document.createElement('canvas');
        canvas.width = w * anim.frames;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        for (let f = 0; f < anim.frames; f++) {
            ctx.save();
            ctx.translate(f * w + w / 2, h);

            const progress = f / (anim.frames - 1);
            drawProceduralFrame(ctx, state, progress, w, h, primaryColor, lightColor, shadowColor, weaponType, char.facing);

            ctx.restore();
        }

        sheet[state] = { canvas, frames: anim.frames, frameRate: anim.frameRate };
    });

    return sheet;
}

function drawProceduralFrame(ctx, state, progress, w, h, primaryColor, lightColor, shadowColor, weaponType, facing) {
    const headR = 15;
    const neckY = -h + 2 * headR + 4;
    const pelvisY = -45;
    const shoulderY = neckY + 8;
    const armLen = 25;

    // Body tint based on state
    let bodyColor = primaryColor;
    if (state === 'hit') bodyColor = '#ffffff';
    else if (state === 'block') bodyColor = lightColor;

    ctx.strokeStyle = bodyColor;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    // Legs
    let legSwing = 0;
    if (state === 'run') legSwing = Math.sin(progress * Math.PI * 2) * 18;
    else if (state === 'idle') legSwing = Math.sin(progress * Math.PI * 2) * 3;

    // Left leg
    ctx.beginPath();
    ctx.moveTo(-3, pelvisY);
    ctx.lineTo(-12 - legSwing, Math.max(0, -Math.abs(Math.cos(progress * Math.PI * 2)) * 8));
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(3, pelvisY);
    ctx.lineTo(12 + legSwing, Math.max(0, -Math.abs(Math.sin(progress * Math.PI * 2)) * 8));
    ctx.stroke();

    // Spine
    ctx.beginPath();
    ctx.moveTo(0, neckY);
    ctx.lineTo(0, pelvisY);
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(0, -h + headR + 4, headR, 0, Math.PI * 2);
    ctx.stroke();

    // Arms based on state
    if (state === 'attack') {
        const attackProg = progress;
        const angle = -0.8 + attackProg * 2.5;
        const handX = 4 + Math.cos(angle) * armLen;
        const handY = shoulderY + Math.sin(angle) * armLen;

        // Front arm
        ctx.beginPath();
        ctx.moveTo(4, shoulderY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Weapon
        let bladeLen, lineW;
        if (weaponType === 'greatsword') { bladeLen = 60; lineW = 8; }
        else if (weaponType === 'daggers') { bladeLen = 32; lineW = 4; }
        else if (weaponType === 'staff') { bladeLen = 55; lineW = 4; }
        else if (weaponType === 'gauntlets') { bladeLen = 25; lineW = 6; }
        else if (weaponType === 'claws') { bladeLen = 28; lineW = 3; }
        else { bladeLen = 45; lineW = 5; }

        const hx = handX + Math.cos(angle) * 8;
        const hy = handY + Math.sin(angle) * 8;
        const bx = hx + Math.cos(angle) * bladeLen;
        const by = hy + Math.sin(angle) * bladeLen;

        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 15;
        ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();
    } else if (state === 'block') {
        // Blocking pose - arms crossed
        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(-15, -75);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, shoulderY);
        ctx.lineTo(15, -75);
        ctx.stroke();
    } else if (state === 'shoot') {
        // Shooting pose
        ctx.beginPath();
        ctx.moveTo(4, shoulderY);
        ctx.lineTo(25, shoulderY);
        ctx.stroke();
        // Projectile
        ctx.save();
        ctx.fillStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(30, shoulderY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    } else if (state === 'jump') {
        // Jumping pose
        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(-12, -70);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, shoulderY);
        ctx.lineTo(12, -70);
        ctx.stroke();
    } else if (state === 'hit') {
        // Hit reaction
        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(-15, -60);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, shoulderY);
        ctx.lineTo(15, -60);
        ctx.stroke();
    } else if (state === 'death') {
        // Death pose - falling
        const fallProg = progress;
        ctx.save();
        ctx.translate(0, fallProg * 30);
        ctx.rotate(fallProg * 0.5);
        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(-12 + fallProg * 10, -60 + fallProg * 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, shoulderY);
        ctx.lineTo(12 - fallProg * 10, -60 + fallProg * 20);
        ctx.stroke();
        // Legs dangling
        ctx.beginPath();
        ctx.moveTo(-3, pelvisY);
        ctx.lineTo(-10, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(3, pelvisY);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.restore();
    } else {
        // Idle/Run default arms
        const armSwing = state === 'run' ? Math.sin(progress * Math.PI * 2) * 0.3 : Math.sin(progress * Math.PI * 2) * 0.1;
        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(-12 + armSwing * 6, -70);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, shoulderY);
        ctx.lineTo(12 - armSwing * 6, -70);
        ctx.stroke();
    }

    // Back weapon for Shadow / Assassin / etc.
    if ((weaponType === 'daggers' || weaponType === 'claws') && state !== 'attack') {
        const angle = -1.8 + (state === 'run' ? Math.sin(progress * Math.PI * 2) * 0.3 : 0);
        const armLen = weaponType === 'claws' ? 18 : 21;
        const lhx = -4 + Math.cos(angle) * armLen;
        const lhy = shoulderY + Math.sin(angle) * armLen;

        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(lhx, lhy);
        ctx.stroke();

        // Weapon
        const backLen = weaponType === 'claws' ? 25 : 22;
        const hx = lhx + Math.cos(angle) * 5;
        const hy = lhy + Math.sin(angle) * 5;
        const bx = hx + Math.cos(angle) * backLen;
        const by = hy + Math.sin(angle) * backLen;

        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 12;
        ctx.lineWidth = weaponType === 'claws' ? 3 : 4;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();
    }
}

function updateSpriteAnimation(char) {
    if (!char.useSprites) return;

    // Determine current animation state
    let newState = 'idle';
    if (char.hp <= 0) newState = 'death';
    else if (char.isHitstun > 0) newState = 'hit';
    else if (char.isAttacking) newState = 'attack';
    else if (char.isBlocking) newState = 'block';
    else if (char.isShooting) newState = 'shoot';
    else if (char.isJumping || char.y > 0) newState = 'jump';
    else if (char.isMoving) newState = 'run';

    if (char.spriteState !== newState) {
        char.spriteState = newState;
        char.spriteFrame = 0;
        char.spriteTimer = 0;
    }

    const anim = char.spriteSheets[char.spriteState];
    if (!anim) return;

    char.spriteTimer++;
    if (char.spriteTimer >= 60 / anim.frameRate) {
        char.spriteTimer = 0;
        char.spriteFrame = (char.spriteFrame + 1) % anim.frames;
    }
}

function drawSprite(char, isPlayer) {
    if (!char.useSprites || !char.spriteSheets[char.spriteState]) {
        // Fallback to procedural drawing
        drawFighter(char, isPlayer);
        return;
    }

    const anim = char.spriteSheets[char.spriteState];
    const frameW = char.width;
    const frameH = char.height;
    const sx = char.spriteFrame * frameW;
    const sy = 0;

    ctx.save();
    ctx.translate(char.x + frameW / 2, (arenaHeight - groundHeight) - char.y);
    ctx.scale(char.facing, 1);

    // Hit flash effect
    if (char.hitTimer > 0) {
        ctx.filter = 'brightness(2)';
    }

    ctx.drawImage(anim.canvas, sx, sy, frameW, frameH, -frameW / 2, -frameH, frameW, frameH);

    // Draw shield overlay when blocking (even with sprites)
    if (char.isBlocking) {
        ctx.save();
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = char.shadowColor;
        ctx.strokeStyle = char.lightColor;

        const shieldRadius = char.height * 0.55;
        const shieldGrad = ctx.createRadialGradient(0, -char.height / 2, 10, 0, -char.height / 2, shieldRadius);
        shieldGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        shieldGrad.addColorStop(1, isPlayer ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)");
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

    ctx.restore();
}

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
    // Sprite animation
    spriteState: "idle",
    spriteFrame: 0,
    spriteTimer: 0,
    useSprites: false,
    spriteSheets: {}
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
    // Sprite animation
    spriteState: "idle",
    spriteFrame: 0,
    spriteTimer: 0,
    useSprites: false,
    spriteSheets: {}
};

function applyClassStats(char, className) {
    char.className = className;
    const info = CHARACTER_CLASSES[className];
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

    // Create procedural sprite sheets
    char.spriteSheets = createProceduralSpriteSheet(char);
    char.useSprites = true;
    char.spriteState = 'idle';
    char.spriteFrame = 0;
    char.spriteTimer = 0;
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
    canvas.width = arenaWidth * dpr;
    canvas.height = arenaHeight * dpr;

    ctx.resetTransform();
    ctx.scale(dpr, dpr);
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
    gainNode.connect(audioCtx.destination);
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
    gainNode.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
    gainNode.gain.setValueAtTime(0.25, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
}

// Countdown before game starts
function startCountdown(callback) {
    isCountingDown = true;
    clearKeys();

    countdownOverlay.classList.remove("hidden");

    let count = 3;

    function nextCount() {
        if (count > 0) {
            countdownText.textContent = count;
            statusText.textContent = count;
            playCountdownSound();

            countdownText.style.animation = 'none';
            countdownText.offsetHeight; // trigger reflow
            countdownText.style.animation = null;

            count--;
            setTimeout(nextCount, 1000);
        } else {
            countdownText.textContent = "MULAI!";
            statusText.textContent = "FIGHT!";
            playCountdownFinalSound();

            countdownText.style.animation = 'none';
            countdownText.offsetHeight; // trigger reflow
            countdownText.style.animation = null;

            setTimeout(() => {
                countdownOverlay.classList.add("hidden");
                isCountingDown = false;
                if (callback) callback();
            }, 800);
        }
    }

    nextCount();
}

// Keyboard events
document.addEventListener("keydown", function (event) {
    if (inMainMenu) return;

    const key = event.key.toLowerCase();
    const code = event.code;

    if (key === "p") {
        if (gameRunning && !isCountingDown) {
            togglePause();
        }
        return;
    }

    if (isPaused || isCountingDown) return;

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
});

btnStart2P.addEventListener("click", function () {
    mainMenu.classList.add("hidden");
    gameMode = "2P";
    selectingPlayer = 1;
    charSelectTitle.textContent = "PLAYER 1: SELECT CHARACTER";
    charSelectSubtitle.textContent = "Pilih Kelas Pertarungan Player 1";
    charSelectMenu.classList.remove("hidden");
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

btnBackToMenu.addEventListener("click", () => {
    charSelectMenu.classList.add("hidden");
    mainMenu.classList.remove("hidden");
    inMainMenu = true;
});

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
        card.style.borderColor = "rgba(255, 255, 255, 0.1)";
    });
    const stage = STAGES[stageName];
    const cardId = `cardStage${stageName.charAt(0).toUpperCase() + stageName.slice(1)}`;
    document.getElementById(cardId).style.borderColor = stage.neonColor;
}

function updatePlayerMovement() {
    if (!gameRunning) return;

    // Pasif EX charge
    player.ex = Math.min(100, player.ex + 0.05);

    const isGrounded = player.y <= 0;
    const inHitstun = player.isHitstun > 0;
    const inJuggle = player.isJuggling;

    if (inHitstun || inJuggle) {
        player.isHitstun = Math.max(0, player.isHitstun - 1);
        player.isBlocking = false;
        player.isMoving = false;

        // Air physics during hitstun/juggle
        player.velocityX *= airDrag;
        player.x += player.velocityX;
        player.y += player.velocityY;
        player.velocityY -= gravity;

        // Ground recovery
        if (player.y <= 0) {
            player.y = 0;
            player.velocityY = 0;
            if (player.isJumping || inJuggle) {
                player.isJumping = false;
                player.isJuggling = false;
                player.juggleCount = 0;
                spawnImpactDust(player.x + player.width / 2, arenaHeight - groundHeight, player.color);
            }
        }
        limitPosition(player);
        return;
    }

    player.isMoving = false;

    // Tangkis/Block dengan menahan tombol S
    if (keys["s"] && isGrounded) {
        player.isBlocking = true;
    } else {
        player.isBlocking = false;

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
            // Air control - reduced
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

    if (player.isBlocking) player.velocityX = 0;

    // Apply friction/drag
    if (isGrounded) {
        player.velocityX *= player.isMoving ? groundFriction : 0.68;
    } else {
        player.velocityX *= airDrag;
    }

    player.velocityX = Math.max(-player.speed, Math.min(player.speed, player.velocityX));
    player.x += player.velocityX;
    player.animTime += player.isMoving ? Math.abs(player.velocityX) * 0.045 : (inJuggle ? 0.02 : 0.035);
    player.y += player.velocityY;
    player.velocityY -= gravity;

    if (player.y <= 0) {
        player.y = 0;
        player.velocityY = 0;
        if (player.isJumping || player.isJuggling) {
            player.isJumping = false;
            player.isJuggling = false;
            player.juggleCount = 0;
            spawnImpactDust(player.x + player.width / 2, arenaHeight - groundHeight, player.color);
        }
    }

    limitPosition(player);

    // Update sprite animation
    updateSpriteAnimation(player);

    // Serang & Hadouken Player 1
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

    // Pasif EX charge
    enemy.ex = Math.min(100, enemy.ex + 0.05);

    const isGrounded = enemy.y <= 0;
    const inHitstun = enemy.isHitstun > 0;
    const inJuggle = enemy.isJuggling;

    if (inHitstun || inJuggle) {
        enemy.isHitstun = Math.max(0, enemy.isHitstun - 1);
        enemy.isBlocking = false;
        enemy.isMoving = false;

        // Air physics during hitstun/juggle
        enemy.velocityX *= airDrag;
        enemy.x += enemy.velocityX;
        enemy.y += enemy.velocityY;
        enemy.velocityY -= gravity;

        // Ground recovery
        if (enemy.y <= 0) {
            enemy.y = 0;
            enemy.velocityY = 0;
            if (enemy.isJumping || inJuggle) {
                enemy.isJumping = false;
                enemy.isJuggling = false;
                enemy.juggleCount = 0;
                spawnImpactDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight, enemy.color);
            }
        }
        limitPosition(enemy);
        return;
    }

    enemy.isMoving = false;

    // Tangkis/Block dengan menahan tombol ArrowDown
    if (keys["arrowdown"] && isGrounded) {
        enemy.isBlocking = true;
    } else {
        enemy.isBlocking = false;

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
            // Air control - reduced
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

    if (enemy.isBlocking) enemy.velocityX = 0;

    // Apply friction/drag
    if (isGrounded) {
        enemy.velocityX *= enemy.isMoving ? groundFriction : 0.68;
    } else {
        enemy.velocityX *= airDrag;
    }

    enemy.velocityX = Math.max(-enemy.speed, Math.min(enemy.speed, enemy.velocityX));
    enemy.x += enemy.velocityX;
    enemy.animTime += enemy.isMoving ? Math.abs(enemy.velocityX) * 0.045 : (inJuggle ? 0.02 : 0.035);
    enemy.y += enemy.velocityY;
    enemy.velocityY -= gravity;

    if (enemy.y <= 0) {
        enemy.y = 0;
        enemy.velocityY = 0;
        if (enemy.isJumping || enemy.isJuggling) {
            enemy.isJumping = false;
            enemy.isJuggling = false;
            enemy.juggleCount = 0;
            spawnImpactDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight, enemy.color);
        }
    }

    limitPosition(enemy);

    // Update sprite animation
    updateSpriteAnimation(enemy);

    // Serang & Hadouken Player 2
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

    // Pasif EX charge
    enemy.ex = Math.min(100, enemy.ex + 0.05);

    const isGrounded = enemy.y <= 0;
    const inHitstun = enemy.isHitstun > 0;
    const inJuggle = enemy.isJuggling;

    if (inHitstun || inJuggle) {
        enemy.isHitstun = Math.max(0, enemy.isHitstun - 1);
        enemy.isBlocking = false;
        enemy.isMoving = false;

        // Air physics during hitstun/juggle
        enemy.velocityX *= airDrag;
        enemy.x += enemy.velocityX;
        enemy.y += enemy.velocityY;
        enemy.velocityY -= gravity;

        // Ground recovery
        if (enemy.y <= 0) {
            enemy.y = 0;
            enemy.velocityY = 0;
            if (enemy.isJumping || inJuggle) {
                enemy.isJumping = false;
                enemy.isJuggling = false;
                enemy.juggleCount = 0;
                spawnImpactDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight, enemy.color);
            }
        }
        limitPosition(enemy);
        return;
    }

    enemy.isMoving = false;

    const distance = getDistance(player, enemy);
    const isEasyMode = gameMode === "1P";

    // AI Blocking Reaction - easier in 1P
    const blockChance = isEasyMode ? 0.008 : 0.015;
    const blockDistance = isEasyMode ? 100 : 130;
    const blockTimer = isEasyMode ? 8 : 12;

    if (enemy.blockingTimer > 0) {
        enemy.blockingTimer--;
        enemy.isBlocking = true;
    } else {
        enemy.isBlocking = false;
        if (player.isAttacking && distance < blockDistance && Math.random() < blockChance && !enemy.attackCooldown) {
            enemy.isBlocking = true;
            enemy.blockingTimer = blockTimer;
        }
    }

    // AI State Machine - easier in 1P
    if (enemy.aiStateTimer <= 0) {
        const rand = Math.random();

        if (distance > 220) {
            // Far: more idle in easy mode
            const chaseChance = isEasyMode ? 0.55 : 0.70;
            const shootChance = isEasyMode ? 0.70 : 0.85;
            if (rand < chaseChance) enemy.aiState = "chase";
            else if (rand < shootChance) enemy.aiState = "shoot";
            else enemy.aiState = "idle";
            enemy.aiStateTimer = 40 + Math.random() * 40; // longer delays in easy
        } else {
            // Close range
            if (enemy.attackCooldown) {
                // More retreat/idle in easy mode
                const retreatChance = isEasyMode ? 0.60 : 0.50;
                const idleChance = isEasyMode ? 0.80 : 0.75;
                if (rand < retreatChance) enemy.aiState = "retreat";
                else if (rand < idleChance) enemy.aiState = "idle";
                else enemy.aiState = "chase";
            } else {
                // Ready to attack - much less aggressive in easy
                const attackChance = isEasyMode ? 0.20 : 0.35;
                const defendChance = isEasyMode ? 0.30 : 0.50;
                if (rand < attackChance) enemy.aiState = "chase";
                else if (rand < defendChance) enemy.aiState = "defend";
                else enemy.aiState = "idle";
            }
            enemy.aiStateTimer = 45 + Math.random() * 50; // longer delays
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

    if (enemy.aiState === "defend") {
        enemy.isBlocking = true;
        return;
    }

    if (player.x < enemy.x) enemy.facing = -1;
    else enemy.facing = 1;

    if (enemy.aiState === "chase") {
        const chaseDistance = isEasyMode ? 130 : 110;
        const attackChance = isEasyMode ? 0.45 : 0.70;

        if (distance > chaseDistance) {
            enemy.isMoving = true;
            enemy.velocityX += (player.x < enemy.x ? -1 : 1) * enemy.speed * 0.18; // slower approach

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

    // AI physics
    if (enemy.isBlocking) enemy.velocityX = 0;
    if (isGrounded) {
        enemy.velocityX *= enemy.isMoving ? groundFriction : 0.68;
    } else {
        enemy.velocityX *= airDrag;
    }
    enemy.velocityX = Math.max(-enemy.speed, Math.min(enemy.speed, enemy.velocityX));
    enemy.x += enemy.velocityX;
    enemy.animTime += enemy.isMoving ? Math.abs(enemy.velocityX) * 0.045 : 0.035;
    enemy.y += enemy.velocityY;
    enemy.velocityY -= gravity;

    if (enemy.y <= 0) {
        enemy.y = 0;
        enemy.velocityY = 0;
        if (enemy.isJumping) {
            enemy.isJumping = false;
            spawnImpactDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight, enemy.color);
        }
    }

    limitPosition(enemy);

    // Update sprite animation
    updateSpriteAnimation(enemy);
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

    setTimeout(() => { player.isAttacking = false; }, 180);
    setTimeout(() => { player.attackCooldown = false; }, 450);
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

    setTimeout(() => { enemy.isAttacking = false; }, duration);
    setTimeout(() => { enemy.attackCooldown = false; }, cooldown);
}

function playerShoot() {
    if (!gameRunning) return;
    if (player.ex < 30) return;
    if (player.isBlocking || player.isAttacking || player.attackCooldown || player.isShooting) return;

    player.isShooting = true;
    player.ex -= 30;

    playSound('projectile');
    spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);

    const pX = player.x + (player.facing === 1 ? player.width + 10 : -20);
    const pY = (arenaHeight - groundHeight) - player.y - player.height * 0.65;

    projectiles.push({
        x: pX,
        y: pY,
        vx: player.facing * 9,
        radius: 12,
        owner: player,
        color: player.lightColor,
        shadowColor: player.shadowColor
    });

    setTimeout(() => {
        player.isShooting = false;
    }, 200);
}

function enemyShoot() {
    if (!gameRunning) return;
    if (enemy.ex < 30) return;
    if (enemy.isBlocking || enemy.isAttacking || enemy.attackCooldown || enemy.isShooting) return;

    enemy.isShooting = true;
    enemy.ex -= 30;

    playSound('projectile');
    spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);

    const pX = enemy.x + (enemy.facing === 1 ? enemy.width + 10 : -20);
    const pY = (arenaHeight - groundHeight) - enemy.y - enemy.height * 0.65;

    projectiles.push({
        x: pX,
        y: pY,
        vx: enemy.facing * 9,
        radius: 12,
        owner: enemy,
        color: enemy.lightColor,
        shadowColor: enemy.shadowColor
    });

    setTimeout(() => {
        enemy.isShooting = false;
    }, 200);
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
    setTimeout(() => {
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

function checkWinner() {
    if (enemy.hp <= 0) {
        gameRunning = false;
        roundOver = true;
        if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
        // KO Slow-mo
        koSlowMo = 90; // 1.5 seconds at 60fps
        koSlowMoTarget = enemy;
        screenShake = 20;
        hitStopFrames = 30;
    } else if (player.hp <= 0) {
        gameRunning = false;
        roundOver = true;
        if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
        // KO Slow-mo
        koSlowMo = 90;
        koSlowMoTarget = player;
        screenShake = 20;
        hitStopFrames = 30;
    } else if (roundTimer <= 0) {
        gameRunning = false;
        roundOver = true;
        if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
        const msg = player.hp > enemy.hp ? (gameMode === "1P" ? "PLAYER WIN!" : "PLAYER 1 WIN!") : (gameMode === "1P" ? "ENEMY WIN!" : "PLAYER 2 WIN!");
        statusText.textContent = msg + " (TIME UP!)";
        showGameOver(msg + " (TIME UP!)");
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
        if (p.x < -30 || p.x > arenaWidth + 30) {
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

        // Collision circle with box
        if (p.x + p.radius > targetLeft && p.x - p.radius < targetRight &&
            p.y + p.radius > targetTop && p.y - p.radius < targetBottom) {

            const isPlayerTarget = (target === player);

            if (target.isBlocking && target.facing === -p.owner.facing) {
                // Blocked!
                target.hp -= 1; // chip
                target.hp = Math.max(target.hp, 0);
                target.ex = Math.min(100, target.ex + 10);

                target.velocityX += p.owner.facing * 8 / (target.knockbackResistance || 1);
                playSound('block');

                // Yellow block sparks
                spawnSparks(p.x, p.y, "#facc15");
                spawnImpactDust(p.x, p.y, "#facc15");
            } else {
                // Hit! - apply juggle physics
                target.hp -= 12; // Projectile damage
                target.hp = Math.max(target.hp, 0);
                target.hitTimer = 12;

                const kbResist = target.knockbackResistance || 1;
                const baseKnockbackX = 6 / kbResist;
                const baseKnockbackY = 9 / kbResist;

                const wasGrounded = target.y <= 0;
                const isJuggle = target.isJuggling || (!wasGrounded && target.juggleCount < 3);

                if (isJuggle || !wasGrounded) {
                    target.isJuggling = true;
                    target.juggleCount++;
                    target.velocityY = baseKnockbackY * (1.1 - target.juggleCount * 0.15);
                    target.velocityX += p.owner.facing * baseKnockbackX * 0.7;
                    target.isHitstun = 16 + target.juggleCount * 2;
                    hitStopFrames = 6;
                    screenShake = 8;
                } else {
                    target.velocityX += p.owner.facing * baseKnockbackX * 1.3;
                    target.velocityY = baseKnockbackY * 0.5;
                    target.isHitstun = 14;
                    hitStopFrames = 5;
                    screenShake = 6;
                    target.isJuggling = true;
                    target.juggleCount = 1;
                }

                p.owner.ex = Math.min(100, p.owner.ex + 15);
                target.ex = Math.min(100, target.ex + 6);

                playSound('hit');
                triggerHitFlash();

                // Damage number popup for projectile
                const isCrit = target.isJuggling;
                damageNumbers.push(new DamageNumber(p.x, p.y, 12, isCrit));

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
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.shadowColor;
        ctx.fill();

        // Projectile inner core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();
    }
}

function drawFighter(char, isPlayer) {
    const groundY = arenaHeight - groundHeight;
    const centerX = char.x + char.width / 2;
    const bottomY = groundY - char.y;
    const armLength = 25;

    ctx.save();
    ctx.translate(centerX, bottomY);
    ctx.scale(char.facing, 1);

    const primaryColor = char.color;
    const lightColor = char.lightColor;
    const shadowColor = char.shadowColor;
    const idleBreath = Math.sin(char.animTime) * (char.isMoving || char.isAttacking ? 0.5 : 1.8);
    const recoil = char.isHitstun > 0 ? 5 : 0;
    ctx.translate(-char.facing * recoil, idleBreath);

    ctx.lineWidth = char.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (char.hitTimer > 0) {
        ctx.strokeStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 20;
    } else {
        ctx.strokeStyle = primaryColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 15;
    }

    // 1. Draw energy shield if blocking
    if (char.isBlocking) {
        ctx.save();
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = shadowColor;
        ctx.strokeStyle = lightColor;

        const shieldRadius = char.height * 0.55;
        const shieldGrad = ctx.createRadialGradient(0, -char.height / 2, 10, 0, -char.height / 2, shieldRadius);
        shieldGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
        shieldGrad.addColorStop(1, isPlayer ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)");
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
    } else if (char.isJumping) {
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
        const swing = Math.sin(char.animTime);
        leftLegX = -12 - swing * 14;
        leftLegY = Math.max(0, -Math.abs(Math.cos(char.animTime)) * 8);
        rightLegX = 12 + swing * 14;
        rightLegY = Math.max(0, -Math.abs(Math.sin(char.animTime)) * 8);
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

    // D. Back Arm (Left Arm) - Khusus Shadow memegang belati kedua!
    if (char.weaponType === "daggers") {
        // Shadow Back Dagger (Twin Daggers style)
        let leftArmAngle = -1.8; // default backward/upward
        if (char.isBlocking) {
            leftArmAngle = 0.5;
        } else if (char.isMoving) {
            leftArmAngle = -1.8 + Math.sin(char.animTime) * 0.3;
        } else if (char.isShooting) {
            leftArmAngle = 0; // menembak ke depan
        }

        const armLen = armLength - 4;
        const lhx = -4 + Math.cos(leftArmAngle) * armLen;
        const lhy = shoulderY + Math.sin(leftArmAngle) * armLen;

        // Draw Left Arm
        ctx.beginPath();
        ctx.moveTo(-4, shoulderY);
        ctx.lineTo(lhx, lhy);
        ctx.stroke();

        // Left Dagger (shorter blade)
        const leftHandleLength = 5;
        const leftBladeLength = 22;

        const lhx_end = lhx + Math.cos(leftArmAngle) * leftHandleLength;
        const lhy_end = lhy + Math.sin(leftArmAngle) * leftHandleLength;

        const lbx = lhx_end + Math.cos(leftArmAngle) * leftBladeLength;
        const lby = lhy_end + Math.sin(leftArmAngle) * leftBladeLength;

        // Handle
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lhx, lhy);
        ctx.lineTo(lhx_end, lhy_end);
        ctx.stroke();
        ctx.restore();

        // Blade
        ctx.save();
        ctx.strokeStyle = lightColor;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lhx_end, lhy_end);
        ctx.lineTo(lbx, lby);
        ctx.stroke();
        ctx.restore();
    } else {
        // Striker & Titan standard back arm
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

    // E. Front Arm (Right Arm) & Main Lightsaber
    let armAngle = 0.3;
    if (char.isShooting) {
        armAngle = 0; // Extended straight forward
    } else     if (char.isAttacking) {
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

    // F. Lightsaber / Main Weapon
    const handleLength = 8;
    const bladeLength = char.bladeLength;

    const hx = handX + Math.cos(armAngle) * handleLength;
    const hy = handY + Math.sin(armAngle) * handleLength;

    const bx = hx + Math.cos(armAngle) * bladeLength;
    const by = hy + Math.sin(armAngle) * bladeLength;

    // Hilt crossguard khusus untuk Titan (Greatsword)
    if (char.weaponType === "greatsword") {
        const guardLength = 10;
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

    // Draw Main Blade (Glowing Neon)
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

    ctx.restore();
}

function render() {
    // 1. Clear Canvas
    ctx.clearRect(0, 0, arenaWidth, arenaHeight);
    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
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
            const msg = koSlowMoTarget === player ? (gameMode === "1P" ? "ENEMY WIN!" : "PLAYER 2 WIN!") : (gameMode === "1P" ? "PLAYER WIN!" : "PLAYER 1 WIN!");
            statusText.textContent = msg;
            showGameOver(msg);
            koSlowMoTarget = null;
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
    // Assign classes
    applyClassStats(player, selectedPlayerClass);

    // Assign enemy class berdasarkan mode
    if (gameMode === "1P") {
        const classes = ["striker", "titan", "shadow"];
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
    player.ex = 0;
    player.facing = 1;
    player.isJumping = false;
    player.isAttacking = false;
    player.attackCooldown = false;
    player.isBlocking = false;
    player.isShooting = false;
    player.hitTimer = 0;
    player.isHitstun = 0;
    player.isJuggling = false;
    player.juggleCount = 0;
    player.animTime = 0;
    player.swordTrail = [];
    player.isMoving = false;

    // Recalculate dimensions
    resizeCanvas();

    enemy.x = arenaWidth - 160;
    enemy.y = 0;
    enemy.velocityX = 0;
    enemy.velocityY = 0;
    enemy.hp = enemy.maxHp;
    enemy.ex = 0;
    enemy.facing = -1;
    enemy.isJumping = false;
    enemy.isAttacking = false;
    enemy.attackCooldown = false;
    enemy.isBlocking = false;
    enemy.isShooting = false;
    enemy.hitTimer = 0;
    enemy.isHitstun = 0;
    enemy.isJuggling = false;
    enemy.juggleCount = 0;
    enemy.animTime = 0;
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
    roundTimer = 99;
    koSlowMo = 0;
    koSlowMoTarget = null;
    if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
    roundTimerInterval = setInterval(() => {
        if (gameRunning && !roundOver && roundTimer > 0) {
            roundTimer--;
            statusText.textContent = `${roundTimer}`;
        }
    }, 1000);

    gameRunning = true;

    updateHealthBars();

    if (!inMainMenu) {
        startCountdown();
    } else {
        statusText.textContent = "FIGHT!";
    }
}

// Start Loops
restartGame();
gameLoop();