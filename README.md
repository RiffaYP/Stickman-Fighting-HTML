# Neon Fighter - Simple Fighting Game

A browser-based 2D fighting game built with vanilla HTML5 Canvas, CSS3, and JavaScript (ES6+). No frameworks, no build step — just open `index.html` and play.

![Game Preview](https://img.shields.io/badge/Play-Online-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![Status](https://img.shields.io/badge/Status-Active-success)

---

## ✨ Features

- **6 Unique Characters** — Striker, Titan, Shadow, Mage, Wrestler, Assassin with distinct stats, weapons, and playstyles
- **4 Parallax Stages** — Neon City, Ancient Dojo, Void Arena, Sunset Rooftop with animated backgrounds
- **Physics-Based Combat** — Gravity, knockback, air juggles (max 3 hits), hit pause, screen shake
- **EX Meter System** — Build meter by attacking/blocking, spend 30 EX for Hadouken projectile
- **Smart AI** — Adjustable difficulty (easier in 1P mode), reactive blocking, state-based behavior
- **Multiple Input Methods** — Keyboard, Dual Gamepad (Gamepad API), Mobile Touch Controls
- **Polished UI** — Smooth HP/EX bars, damage numbers, KO slow-mo, low-HP pulse warning
- **Procedural Sprites** — All animations generated at runtime (idle, run, jump, attack, hit, block, shoot, death)

---

## 🎮 Controls

### Player 1 (Keyboard)
| Action | Key |
|--------|-----|
| Move Left | `A` |
| Move Right | `D` |
| Jump | `W` |
| Block | `S` (hold) |
| Attack | `J` |
| Hadouken (EX 30) | `K` |
| Pause | `P` / `ESC` |
| Restart | `R` |

### Player 2 (Keyboard) — Local 2P Mode
| Action | Key |
|--------|-----|
| Move Left | `←` |
| Move Right | `→` |
| Jump | `↑` |
| Block | `↓` (hold) |
| Attack | `0` (Numpad) |
| Hadouken (EX 30) | `1` (Numpad) |

### Gamepad (Dual Supported)
| Action | Button |
|--------|--------|
| Move | Left Stick |
| Jump / Block | Left Stick Up / Down |
| Attack | **A / Cross** (Button 0) |
| Hadouken | **B / Circle** (Button 1) |
| Block | **LB / L1** (Button 6) |
| Pause | **Start / Options** (Button 9) |
| Restart | **Select / Share** (Button 8) |

*Player 1 = first connected gamepad, Player 2 = second gamepad (2P mode only)*

### Mobile Touch
- **Left side** — Virtual joystick for movement
- **Right side** — Action buttons (Attack, Special, Block, Jump)
- Auto-shows on screens ≤ 768px

---

## 👥 Characters

| Class | HP | Speed | Jump | Damage | Weapon | Archetype |
|-------|----|-------|------|--------|--------|-----------|
| **Striker** | 100 | 5.0 | 16 | 10 | Saber | Balanced |
| **Titan** | 130 | 3.5 | 14 | 16 | Greatsword | Heavy / Power |
| **Shadow** | 85 | 6.8 | 18 | 6.5 | Twin Daggers | Speed / Rushdown |
| **Mage** | 80 | 4.0 | 15 | 8 | Staff | Zoner / Projectile |
| **Wrestler** | 150 | 3.0 | 12 | 22 | Gauntlets | Grappler / Tank |
| **Assassin** | 70 | 8.0 | 20 | 9 | Claws | Speed / High Mobility |

---

## 🏟 Stages

| Stage | Theme | Ambient Color |
|-------|-------|---------------|
| **Neon City** | Cyberpunk nightscape | Blue/Cyan |
| **Ancient Dojo** | Traditional training hall | Orange/Amber |
| **Void Arena** | Dark cosmic void | Purple/Magenta |
| **Sunset Rooftop** | Golden hour rooftop | Gold/Amber |

Each stage has unique parallax layers, ambient particles, and neon ground lines.

---

## 🚀 How to Run

```bash
# Option 1: Direct (simplest)
# Just open index.html in any modern browser

# Option 2: Local server (recommended for Gamepad API)
npx serve .
# or
python3 -m http.server 8000
# then open http://localhost:8000
```

**Gamepad API requires HTTPS or localhost** — it won't work on `file://` protocol.

---

## 🛠 Tech Stack

- **HTML5 Canvas** — 2D rendering
- **CSS3** — Flexbox, Grid, animations, backdrop-filter, responsive design
- **Vanilla JavaScript (ES6+)** — Game loop, physics, input, AI, procedural sprite generation
- **Web Audio API** — Synthesized sound effects (slash, hit, block, jump, projectile, win)
- **Gamepad API** — Dual controller support
- **Touch Events** — Mobile virtual controls

No dependencies, no build tools, no transpilation.

---

## 📁 Project Structure

```
.
├── index.html      # Main HTML structure, menus, HUD, touch controls
├── style.css       # All styling (responsive, animations, themes)
├── script.js       # Game engine (physics, AI, rendering, input, sprites)
└── README.md       # This file
```

---

## 🎯 Gameplay Mechanics

- **Health** — Depletes on hit; chip damage (1 HP) on block
- **EX Meter** — Passive gain (0.05/frame) + bonus on hit/block; max 100
- **Hadouken** — Costs 30 EX, projectile with juggle physics
- **Air Juggles** — Max 3 hits, decaying launch height
- **Hit Pause** — 6-30 frames freeze on impact for impact feel
- **KO Slow-Mo** — 1.5s dramatic slowdown before game over
- **Round Timer** — 99 seconds, time-up decides by remaining HP

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/awesome`)
3. Commit changes (`git commit -am 'Add awesome feature'`)
4. Push (`git push origin feature/awesome`)
5. Open Pull Request

---

## 📜 License

MIT License — free to use, modify, distribute.

---

## 🙏 Credits

- Fonts: **Orbitron** & **Inter** (Google Fonts)
- Sound: Synthesized via Web Audio API (no external assets)
- Sprites: Procedurally generated at runtime

---

**Play now:** Open `index.html` → Select Character → Select Stage → FIGHT! 🥊