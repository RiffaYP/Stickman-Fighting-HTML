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
const gravity = 0.8;

// Game states
let gameRunning = false;
let inMainMenu = true;
let isPaused = false;
let isCountingDown = false;
let gameMode = "1P"; // "1P" atau "2P"
let selectingPlayer = 1; // 1 atau 2
let selectedEnemyClass = "striker";

// Arena dimensions
let arenaWidth = 950;
let arenaHeight = 450;

// Dynamic arrays for projectiles & particles
let projectiles = [];
let particles = [];

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

// Character classes specifications
const CHARACTER_CLASSES = {
    striker: {
        name: "Striker",
        maxHp: 100,
        speed: 5,
        jumpPower: 15,
        damage: 10,
        color: "#3b82f6",
        lightColor: "#60a5fa",
        shadowColor: "#2563eb",
        weaponType: "saber",
        bladeLength: 45,
        lineWidth: 5,
        projectileColor: "#60a5fa"
    },
    titan: {
        name: "Titan",
        maxHp: 130,
        speed: 3.5,
        jumpPower: 13,
        damage: 16,
        color: "#22c55e",
        lightColor: "#86efac",
        shadowColor: "#15803d",
        weaponType: "greatsword",
        bladeLength: 60,
        lineWidth: 8,
        projectileColor: "#22c55e"
    },
    shadow: {
        name: "Shadow",
        maxHp: 85,
        speed: 6.8,
        jumpPower: 17,
        damage: 6.5,
        color: "#a855f7",
        lightColor: "#d8b4fe",
        shadowColor: "#7e22ce",
        weaponType: "daggers",
        bladeLength: 32,
        lineWidth: 4,
        projectileColor: "#a855f7"
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
    animTime: 0,
    attackStartTime: 0,
    swordTrail: [],
    isMoving: false,
    className: "striker"
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
    animTime: 0,
    attackStartTime: 0,
    blockingTimer: 0,
    swordTrail: [],
    isMoving: false,
    className: "striker",
    aiState: "chase",
    aiStateTimer: 0
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
    for (let i = 0; i < 6; i++) {
        const vx = (Math.random() - 0.5) * 2.5;
        const vy = -Math.random() * 1.5;
        const size = 2 + Math.random() * 3.5;
        const life = 10 + Math.random() * 15;
        particles.push(new Particle(x, y, "rgba(255, 255, 255, 0.35)", vx, vy, size, life));
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

            countdownText.style.animation = 'none';
            countdownText.offsetHeight; // trigger reflow
            countdownText.style.animation = null;

            count--;
            setTimeout(nextCount, 1000);
        } else {
            countdownText.textContent = "MULAI!";
            statusText.textContent = "FIGHT!";

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

    if (key === "p") {
        if (gameRunning && !isCountingDown) {
            togglePause();
        }
        return;
    }

    if (isPaused || isCountingDown) return;

    if (key === "0" || event.code === "Numpad0") {
        keys["0"] = true;
    } else if (key === "1" || event.code === "Numpad1") {
        keys["1"] = true;
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

    if (key === "0" || event.code === "Numpad0") {
        keys["0"] = false;
    } else if (key === "1" || event.code === "Numpad1") {
        keys["1"] = false;
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

function updatePlayerMovement() {
    if (!gameRunning) return;

    player.isMoving = false;

    // Pasif EX charge
    player.ex = Math.min(100, player.ex + 0.05);

    // Tangkis/Block dengan menahan tombol S
    if (keys["s"]) {
        player.isBlocking = true;
    } else {
        player.isBlocking = false;

        if (keys["a"]) {
            player.x -= player.speed;
            player.facing = -1;
            player.isMoving = true;
            player.animTime += 0.15;

            if (!player.isJumping && Math.random() < 0.2) {
                spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);
            }
        }

        if (keys["d"]) {
            player.x += player.speed;
            player.facing = 1;
            player.isMoving = true;
            player.animTime += 0.15;

            if (!player.isJumping && Math.random() < 0.2) {
                spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);
            }
        }

        if (keys["w"] && !player.isJumping) {
            player.velocityY = player.jumpPower;
            player.isJumping = true;
            playSound('jump');
            spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);
        }
    }

    player.y += player.velocityY;
    player.velocityY -= gravity;

    if (player.y <= 0) {
        player.y = 0;
        player.velocityY = 0;
        if (player.isJumping) {
            player.isJumping = false;
            spawnDust(player.x + player.width / 2, arenaHeight - groundHeight);
        }
    }

    limitPosition(player);

    // Serang & Hadouken Player 1
    if (keys["j"]) {
        playerAttack();
        keys["j"] = false; // consume input
    }
    if (keys["k"]) {
        playerShoot();
        keys["k"] = false; // consume input
    }
}

function updateEnemyPlayerMovement() {
    if (!gameRunning) return;

    enemy.isMoving = false;

    // Pasif EX charge
    enemy.ex = Math.min(100, enemy.ex + 0.05);

    // Tangkis/Block dengan menahan tombol ArrowDown
    if (keys["arrowdown"]) {
        enemy.isBlocking = true;
    } else {
        enemy.isBlocking = false;

        if (keys["arrowleft"]) {
            enemy.x -= enemy.speed;
            enemy.facing = -1;
            enemy.isMoving = true;
            enemy.animTime += 0.15;

            if (!enemy.isJumping && Math.random() < 0.2) {
                spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            }
        }

        if (keys["arrowright"]) {
            enemy.x += enemy.speed;
            enemy.facing = 1;
            enemy.isMoving = true;
            enemy.animTime += 0.15;

            if (!enemy.isJumping && Math.random() < 0.2) {
                spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            }
        }

        if (keys["arrowup"] && !enemy.isJumping) {
            enemy.velocityY = enemy.jumpPower;
            enemy.isJumping = true;
            playSound('jump');
            spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
        }
    }

    enemy.y += enemy.velocityY;
    enemy.velocityY -= gravity;

    if (enemy.y <= 0) {
        enemy.y = 0;
        enemy.velocityY = 0;
        if (enemy.isJumping) {
            enemy.isJumping = false;
            spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
        }
    }

    limitPosition(enemy);

    // Serang & Hadouken Player 2
    if (keys["0"]) {
        enemyAttack();
        keys["0"] = false; // consume input
    }
    if (keys["1"]) {
        enemyShoot();
        keys["1"] = false; // consume input
    }
}

function updateEnemyAI() {
    if (!gameRunning) return;

    enemy.isMoving = false;

    // Pasif EX charge
    enemy.ex = Math.min(100, enemy.ex + 0.05);

    const distance = getDistance(player, enemy);

    // AI Blocking Reaction (React to player attacking)
    // Diturunkan peluangnya dari 0.08 ke 0.045 agar AI tidak terlalu dewa menangkis
    if (enemy.blockingTimer > 0) {
        enemy.blockingTimer--;
        enemy.isBlocking = true;
        return;
    } else {
        enemy.isBlocking = false;

        if (player.isAttacking && distance < 130 && Math.random() < 0.045 && !enemy.attackCooldown) {
            enemy.isBlocking = true;
            enemy.blockingTimer = 18; // menangkis selama 18 frame
            return;
        }
    }

    // AI State Machine (Untuk mengurangi keagresifan)
    if (enemy.aiStateTimer <= 0) {
        const rand = Math.random();

        if (distance > 220) {
            // Jarak Jauh: 70% Chase, 15% Shoot, 15% Idle
            if (rand < 0.70) {
                enemy.aiState = "chase";
            } else if (rand < 0.85) {
                enemy.aiState = "shoot";
            } else {
                enemy.aiState = "idle";
            }
            enemy.aiStateTimer = 30 + Math.random() * 30; // 0.5s - 1.0s
        } else {
            // Jarak Dekat: Jika serangan cooldown, 50% mundur, 25% diam, 25% serang balik
            if (enemy.attackCooldown) {
                if (rand < 0.50) {
                    enemy.aiState = "retreat";
                } else if (rand < 0.75) {
                    enemy.aiState = "idle";
                } else {
                    enemy.aiState = "chase";
                }
            } else {
                // Siap menyerang: 55% serang/chase, 25% tangkis bertahan, 20% diam
                if (rand < 0.55) {
                    enemy.aiState = "chase";
                } else if (rand < 0.80) {
                    enemy.aiState = "defend";
                } else {
                    enemy.aiState = "idle";
                }
            }
            enemy.aiStateTimer = 20 + Math.random() * 20; // 0.3s - 0.7s
        }
    } else {
        enemy.aiStateTimer--;
    }

    // Eksekusi State
    if (enemy.aiState === "shoot") {
        if (enemy.ex >= 30) {
            enemyShoot();
        } else {
            enemy.aiState = "chase"; // ganti state jika EX tidak cukup
        }
    }

    if (enemy.aiState === "defend") {
        enemy.isBlocking = true;
        return; // berdiri diam dan menangkis
    }

    if (player.x < enemy.x) {
        enemy.facing = -1;
    } else {
        enemy.facing = 1;
    }

    if (enemy.aiState === "chase") {
        if (distance > 95) {
            enemy.isMoving = true;
            enemy.animTime += 0.15;

            if (player.x < enemy.x) {
                enemy.x -= enemy.speed;
            } else {
                enemy.x += enemy.speed;
            }

            if (Math.random() < 0.05 && !enemy.isJumping) {
                spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
            }
        } else {
            enemyAttack();
        }
    } else if (enemy.aiState === "retreat") {
        // Mundur dari player
        enemy.isMoving = true;
        enemy.animTime += 0.15;

        // Mundur dengan kecepatan lebih lambat (75% speed kelas)
        const retreatSpeed = enemy.speed * 0.75;

        if (player.x < enemy.x) {
            enemy.x += retreatSpeed; // menjauh ke kanan
        } else {
            enemy.x -= retreatSpeed; // menjauh ke kiri
        }

        if (Math.random() < 0.05 && !enemy.isJumping) {
            spawnDust(enemy.x + enemy.width / 2, arenaHeight - groundHeight);
        }
    } else if (enemy.aiState === "idle") {
        // Diam, tidak melakukan apa-apa
        enemy.isMoving = false;
    }

    // AI physics (in case of gravity/pushback)
    enemy.y += enemy.velocityY;
    enemy.velocityY -= gravity;
    if (enemy.y <= 0) {
        enemy.y = 0;
        enemy.velocityY = 0;
        enemy.isJumping = false;
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
            enemy.x += player.facing * 12;

            playSound('block');

            // Efek percikan perisai kuning emas
            const sparkX = enemy.x + (enemy.width / 2) - player.facing * 20;
            const sparkY = (arenaHeight - groundHeight) - enemy.y - enemy.height / 2;
            spawnSparks(sparkX, sparkY, "#facc15");
        } else {
            // Serangan telak
            enemy.hp -= player.damage;
            enemy.hp = Math.max(enemy.hp, 0);
            enemy.hitTimer = 10; // Flashing putih

            // Serangan sukses menambah EX penyerang
            player.ex = Math.min(100, player.ex + 15);
            // Musuh yang terpukul mendapat EX sedikit
            enemy.ex = Math.min(100, enemy.ex + 6);

            // Dorongan balik besar
            enemy.x += player.facing * 25;

            playSound('hit');

            // Efek darah/percikan merah
            const sparkX = enemy.x + enemy.width / 2;
            const sparkY = (arenaHeight - groundHeight) - enemy.y - enemy.height / 2;
            spawnSparks(sparkX, sparkY, enemy.lightColor);
        }

        updateHealthBars();
        checkWinner();
    }

    setTimeout(function () {
        player.isAttacking = false;
    }, 180);

    setTimeout(function () {
        player.attackCooldown = false;
    }, 450);
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
            player.hp -= 1; // chip damage
            player.hp = Math.max(player.hp, 0);

            player.ex = Math.min(100, player.ex + 10);

            player.x += enemy.facing * 10;

            playSound('block');

            const sparkX = player.x + (player.width / 2) - enemy.facing * 20;
            const sparkY = (arenaHeight - groundHeight) - player.y - player.height / 2;
            spawnSparks(sparkX, sparkY, "#facc15");
        } else {
            // Serangan telak
            player.hp -= enemy.damage;
            player.hp = Math.max(player.hp, 0);
            player.hitTimer = 10;

            enemy.ex = Math.min(100, enemy.ex + 15);
            player.ex = Math.min(100, player.ex + 6);

            player.x += enemy.facing * 18;

            playSound('hit');

            const sparkX = player.x + player.width / 2;
            const sparkY = (arenaHeight - groundHeight) - player.y - player.height / 2;
            spawnSparks(sparkX, sparkY, player.lightColor);
        }

        updateHealthBars();
        checkWinner();
    }

    const duration = gameMode === "2P" ? 180 : 200;
    const cooldown = gameMode === "2P" ? 450 : 900;

    setTimeout(function () {
        enemy.isAttacking = false;
    }, duration);

    setTimeout(function () {
        enemy.attackCooldown = false;
    }, cooldown);
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

function checkWinner() {
    if (enemy.hp <= 0) {
        gameRunning = false;
        const msg = gameMode === "1P" ? "PLAYER WIN!" : "PLAYER 1 WIN!";
        statusText.textContent = msg;
        showGameOver(msg);
    } else if (player.hp <= 0) {
        gameRunning = false;
        const msg = gameMode === "1P" ? "ENEMY WIN!" : "PLAYER 2 WIN!";
        statusText.textContent = msg;
        showGameOver(msg);
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
        const attackProgress = (Date.now() - char.attackStartTime) / 180;
        angle = -0.8 + attackProgress * 2.5;
    } else if (char.isBlocking) {
        angle = -1.2;
    } else {
        if (char.isMoving) {
            angle = 0.3 + Math.sin(char.animTime) * 0.2;
        }
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
    // Background gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, arenaHeight);
    skyGrad.addColorStop(0, "#0b0f1a");
    skyGrad.addColorStop(1, "#111827");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, arenaWidth, arenaHeight);

    // Background grid lines
    ctx.save();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.06)";
    ctx.lineWidth = 1;

    for (let y = 60; y < arenaHeight - groundHeight; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(arenaWidth, y);
        ctx.stroke();
    }

    // Title watermark
    ctx.font = "bold 36px Orbitron";
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.textAlign = "center";
    ctx.fillText("NEON FIGHT ARENA", arenaWidth / 2, 90);

    // Neon ground
    const groundY = arenaHeight - groundHeight;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, arenaHeight);
    groundGrad.addColorStop(0, "#111827");
    groundGrad.addColorStop(1, "#070b12");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, arenaWidth, groundHeight);

    // Neon ground line
    ctx.strokeStyle = "#facc15";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#eab308";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(arenaWidth, groundY);
    ctx.stroke();

    // Perspective lines
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(250, 204, 21, 0.12)";
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

                target.x += p.owner.facing * 10;
                playSound('block');

                // Yellow block sparks
                spawnSparks(p.x, p.y, "#facc15");
            } else {
                // Hit!
                target.hp -= 12; // Projectile damage
                target.hp = Math.max(target.hp, 0);
                target.hitTimer = 10;

                p.owner.ex = Math.min(100, p.owner.ex + 15);
                target.ex = Math.min(100, target.ex + 6);

                target.x += p.owner.facing * 20;
                playSound('hit');

                spawnSparks(p.x, p.y, target.lightColor);
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

    if (char.isJumping) {
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
    } else if (char.isAttacking) {
        const attackProgress = (Date.now() - char.attackStartTime) / 180;
        armAngle = -0.8 + attackProgress * 2.5;
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
        updatePlayerMovement();
        if (gameMode === "1P") {
            updateEnemyAI();
        } else {
            updateEnemyPlayerMovement();
        }
        updateProjectiles();
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
    player.animTime = 0;
    player.swordTrail = [];
    player.isMoving = false;

    // Recalculate dimensions
    const rect = arena.getBoundingClientRect();
    arenaWidth = rect.width || 950;
    arenaHeight = rect.height || 450;

    enemy.x = arenaWidth - 160;
    enemy.y = 0;
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
    enemy.animTime = 0;
    enemy.blockingTimer = 0;
    enemy.swordTrail = [];
    enemy.isMoving = false;
    enemy.aiState = "chase";
    enemy.aiStateTimer = 0;

    projectiles = [];
    particles = [];

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