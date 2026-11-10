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
let hitStopFrames = 0;
let screenShake = 0;
let roundOver = false;
let roundTimer = 99;
let roundTimerInterval = null;
let bgAnimTime = 0;

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
    juggleDecay: 0.92
};

const enemy = {
    x: 720,
    y: 0,
    width: 70,
    height: 130,
    speed: 2,
    velocityY: 0,
    hp: 100,
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
    juggleDecay: 0.92
};

function applyClassStats(char, className) {
    char.className = className;
    const info = CHARACTER_CLASSES[className];
    char.maxHp = info.maxHp;
    char.hp = info.maxHp;
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
    restartGame();
});

// Character Selection Cards
document.getElementById("cardStriker").addEventListener("click", () => selectChar("striker"));
document.getElementById("cardTitan").addEventListener("click", () => selectChar("titan"));
document.getElementById("cardShadow").addEventListener("click", () => selectChar("shadow"));

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
    // HP
    const pHPPercent = Math.max(0, (player.hp / CHARACTER_CLASSES[player.className].maxHp) * 100);
    const eHPPercent = Math.max(0, (enemy.hp / CHARACTER_CLASSES[enemy.className].maxHp) * 100);

    playerHealthElement.style.width = pHPPercent + "%";
    enemyHealthElement.style.width = eHPPercent + "%";

    // EX Bars
    playerExElement.style.width = player.ex + "%";
    enemyExElement.style.width = enemy.ex + "%";

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
        const msg = gameMode === "1P" ? "PLAYER WIN!" : "PLAYER 1 WIN!";
        statusText.textContent = msg;
        showGameOver(msg);
    } else if (player.hp <= 0) {
        gameRunning = false;
        roundOver = true;
        if (roundTimerInterval) { clearInterval(roundTimerInterval); roundTimerInterval = null; }
        const msg = gameMode === "1P" ? "ENEMY WIN!" : "PLAYER 2 WIN!";
        statusText.textContent = msg;
        showGameOver(msg);
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

    // 6. Draw Fighters
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
}

function gameLoop() {
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
    hitStopFrames = 0;
    screenShake = 0;
    roundOver = false;
    roundTimer = 99;
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