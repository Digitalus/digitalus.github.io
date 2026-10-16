/*! Copyright (c) 2025-2026 Digitalus Maximus. All rights reserved. https://digitalus.github.io */
(function () {
    var TILE = 40;
    var COLS = 12;
    var ROWS = 13;
    var W = COLS * TILE;
    var H = ROWS * TILE;
    var LOOP = W + 2 * TILE;
    var START_COL = 5;
    var START_ROW = ROWS - 1;
    var LIVES = 5;
    var HOP_TIME = 0.2;
    var ROAD_ROWS = [1, 2, 3, 4, 5];
    var RIVER_ROWS = [7, 8, 9, 10, 11];
    var SPEEDS = { 1: 36, 2: -48, 3: 30, 4: -60, 5: 42, 7: 30, 8: -36, 9: 48, 10: -27, 11: 36 };
    var CAR_COLORS = ['#ff2e63', '#ff9f1c', '#00f5d4', '#fee440', '#9b5de5'];

    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    var scoreEl = document.getElementById('score');
    var livesEl = document.getElementById('lives');
    var levelEl = document.getElementById('level');
    var bestEl = document.getElementById('best');
    var restartBtn = document.getElementById('restart');
    var resetBtn = document.getElementById('reset');
    var soundBtn = document.getElementById('sound');

    var lanes = {};
    var state;
    var particles = [];
    var homeFlash = 0;
    var best = Number(localStorage.getItem('frogger-best') || 0);
    var muted = localStorage.getItem('frogger-muted') === 'true';

    var audioCtx = null;

    /**
     * Returns the shared Web Audio context, creating it on first use and
     * resuming it if the browser suspended it (browsers require a user gesture first).
     * @returns {AudioContext}
     */
    function getAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    /**
     * Plays a short synthesized note that fades out, optionally sliding in pitch.
     * Does nothing while sound is muted.
     * @param {number} freq - Starting frequency in Hz.
     * @param {number} dur - Length in seconds.
     * @param {string} type - Oscillator wave shape (sine, square, sawtooth, triangle).
     * @param {number} vol - Starting volume from 0 to 1.
     * @param {number} [slideTo] - Frequency in Hz to glide toward over the note.
     */
    function tone(freq, dur, type, vol, slideTo) {
        if (muted) return;
        var a = getAudio();
        var osc = a.createOscillator();
        var gain = a.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, a.currentTime);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
        gain.gain.setValueAtTime(vol, a.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
        osc.connect(gain).connect(a.destination);
        osc.start();
        osc.stop(a.currentTime + dur);
    }

    /**
     * Plays a burst of low-pass filtered noise that decays quickly (used for the splat sound).
     * Does nothing while sound is muted.
     * @param {number} dur - Length in seconds.
     * @param {number} vol - Volume from 0 to 1.
     * @param {number} cutoff - Low-pass filter cutoff in Hz; lower values sound more muffled.
     */
    function noise(dur, vol, cutoff) {
        if (muted) return;
        var a = getAudio();
        var buffer = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
        }
        var src = a.createBufferSource();
        var filter = a.createBiquadFilter();
        var gain = a.createGain();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;
        gain.gain.value = vol;
        src.buffer = buffer;
        src.connect(filter).connect(gain).connect(a.destination);
        src.start();
    }

    // Sound effects for game events, all synthesized with the helpers above.
    var sounds = {
        // Quick rising chirp when the frog hops.
        hop: function () { tone(360, 0.11, 'sine', 0.14, 620); },
        // Muffled thud with a falling tone when the frog is hit by a car.
        splat: function () {
            noise(0.35, 0.5, 700);
            tone(150, 0.3, 'sine', 0.18, 45);
        },
        // Bright watery splash with a quick falling bloop when the frog falls in the river.
        splash: function () {
            noise(0.45, 0.45, 3500);
            tone(700, 0.25, 'sine', 0.14, 220);
        },
        // Rising four-note fanfare when the frog reaches the HOME strip.
        goal: function () {
            [523, 659, 784, 1047].forEach(function (freq, i) {
                setTimeout(function () { tone(freq, 0.18, 'triangle', 0.14); }, i * 110);
            });
        },
        // Slow falling four-note tone when the last life is lost.
        over: function () {
            [392, 349, 311, 262].forEach(function (freq, i) {
                setTimeout(function () { tone(freq, 0.3, 'triangle', 0.14); }, i * 260);
            });
        }
    };

    /** Updates the Sound button label and its aria-pressed state to match the muted setting. */
    function updateSoundButton() {
        soundBtn.textContent = 'Sound: ' + (muted ? 'Off' : 'On');
        soundBtn.setAttribute('aria-pressed', String(!muted));
    }

    /**
     * Builds the moving cars (road rows) and logs (river rows) for a level.
     * Higher levels add more cars per road lane, fewer and shorter logs per river lane.
     * @param {number} level - The current level, starting at 1.
     */
    function buildLanes(level) {
        var roadCount = Math.min(4, 2 + Math.floor((level - 1) / 2));
        var logCount = Math.max(2, 3 - Math.floor((level - 1) / 3));
        var logWidth = TILE * (level >= 4 ? 3.5 : 4);
        lanes = {};
        ROAD_ROWS.concat(RIVER_ROWS).forEach(function (row) {
            var isRoad = ROAD_ROWS.indexOf(row) !== -1;
            var width = isRoad ? TILE * 1.6 : logWidth;
            var items = [];
            var count = isRoad ? roadCount : logCount;
            for (var i = 0; i < count; i++) {
                items.push({ x: -TILE + i * LOOP / count, w: width, color: CAR_COLORS[(row + i) % CAR_COLORS.length], stripe: (row + i) % 3 === 0, seed: Math.floor(Math.random() * 90) + 1 });
            }
            lanes[row] = { road: isRoad, speed: SPEEDS[row], items: items };
        });
    }

    /**
     * Wraps a horizontal position so objects leaving one side of the board
     * re-enter from the other side.
     * @param {number} x - Position in canvas pixels.
     * @returns {number} Position within the looping range.
     */
    function wrap(x) {
        return ((x + TILE) % LOOP + LOOP) % LOOP - TILE;
    }

    /** Puts the frog back on the start tile, facing up. */
    function resetFrog() {
        state.frog = { x: START_COL * TILE, row: START_ROW, angle: 0, hop: 0 };
    }

    /** Starts a fresh game: full lives, zero score, level 1, and a clean board. */
    function newGame() {
        state = { lives: LIVES, score: 0, level: 1, speed: 1, over: false };
        particles = [];
        marks = [];
        homeFlash = 0;
        buildLanes(1);
        resetFrog();
    }

    /** Saves the score as the new best score (in localStorage) if it beats the old one. */
    function setBest() {
        if (state.score > best) {
            best = state.score;
            localStorage.setItem('frogger-best', String(best));
        }
    }

    /** Marks left on the board after a death: red splats on the road and expanding ripples on the water. */
    var marks = [];

    /**
     * Leaves a red splat where the frog was hit, and flings red droplets outward.
     * @param {number} x - Splat center in canvas pixels.
     * @param {number} y - Splat center in canvas pixels.
     */
    function spawnSplat(x, y) {
        var blobs = [];
        for (var i = 0; i < 9; i++) {
            var a = Math.random() * Math.PI * 2;
            var d = 6 + Math.random() * 14;
            blobs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 2 + Math.random() * 4 });
        }
        marks.push({ kind: 'splat', x: x, y: y, age: 0, life: 3, blobs: blobs });
        for (var j = 0; j < 14; j++) {
            var ang = Math.random() * Math.PI * 2;
            var sp = 50 + Math.random() * 100;
            particles.push({
                x: x, y: y,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
                life: 0.6, max: 0.6, color: Math.random() < 0.5 ? '#ff1a1a' : '#b30000'
            });
        }
    }

    /**
     * Makes a splash where the frog fell in the water: expanding ripple rings
     * and droplets that shoot upward and fall back down.
     * @param {number} x - Splash center in canvas pixels.
     * @param {number} y - Splash center in canvas pixels.
     */
    function spawnSplash(x, y) {
        marks.push({ kind: 'splash', x: x, y: y, age: 0, life: 1 });
        for (var i = 0; i < 22; i++) {
            var ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
            var sp = 90 + Math.random() * 130;
            particles.push({
                x: x, y: y,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                life: 0.8, max: 0.8, color: Math.random() < 0.5 ? '#bff4ff' : '#00cfff'
            });
        }
    }

    /**
     * Draws the marks: a red splat that slowly fades, or three ripple rings
     * that expand and fade quickly.
     */
    function drawMarks() {
        marks.forEach(function (m) {
            var t = m.age / m.life;
            if (m.kind === 'splat') {
                ctx.globalAlpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
                ctx.fillStyle = '#d10000';
                ctx.shadowColor = '#ff1a1a';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.ellipse(m.x, m.y, 15, 12, 0.4, 0, Math.PI * 2);
                ctx.fill();
                m.blobs.forEach(function (b) {
                    ctx.beginPath();
                    ctx.arc(m.x + b.dx, m.y + b.dy, b.r, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.fillStyle = '#ff4040';
                ctx.beginPath();
                ctx.ellipse(m.x - 3, m.y - 2, 6, 4, 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.strokeStyle = '#bff4ff';
                ctx.shadowColor = '#00cfff';
                ctx.shadowBlur = 8;
                ctx.lineWidth = 2;
                for (var i = 0; i < 3; i++) {
                    var rt = t - i * 0.15;
                    if (rt <= 0 || rt >= 1) continue;
                    ctx.globalAlpha = 1 - rt;
                    ctx.beginPath();
                    ctx.ellipse(m.x, m.y, 6 + rt * 30, 4 + rt * 20, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    /**
     * Costs the frog one life. Ends the game on the last life, otherwise restarts the frog at the start.
     * @param {string} kind - 'splat' when hit by a car, 'splash' when the frog fell in the river.
     */
    function die(kind) {
        if (state.over) return;
        var f = state.frog;
        var x = Math.min(W - 10, Math.max(10, f.x + TILE / 2));
        var y = f.row * TILE + TILE / 2;
        state.lives--;
        if (kind === 'splash') {
            spawnSplash(x, y);
            sounds.splash();
        } else {
            spawnSplat(x, y);
            sounds.splat();
        }
        if (state.lives <= 0) {
            state.over = true;
            f.dead = true;
            setBest();
            sounds.over();
        } else {
            resetFrog();
        }
    }

    /**
     * Moves the frog one tile, turns it to face that way, and starts the hop animation.
     * Moving forward scores points; reaching the top row scores a bonus, raises the level
     * and speed, and triggers fireworks and the HOME flash.
     * @param {number} dc - Columns to move (-1 left, 1 right).
     * @param {number} dr - Rows to move (1 up toward HOME, -1 down).
     */
    function hop(dc, dr) {
        if (state.over) return;
        var f = state.frog;
        if (dc > 0) f.angle = Math.PI / 2;
        else if (dc < 0) f.angle = -Math.PI / 2;
        else if (dr < 0) f.angle = Math.PI;
        else if (dr > 0) f.angle = 0;
        f.hop = HOP_TIME;
        var col = Math.min(COLS - 1, Math.max(0, Math.round(f.x / TILE) + dc));
        var row = Math.min(ROWS - 1, Math.max(0, f.row - dr));
        if (row < f.row) state.score += 10;
        f.x = col * TILE;
        f.row = row;
        if (row === 0) {
            state.score += 50;
            state.level++;
            state.speed *= 1.12;
            sounds.goal();
            spawnFireworks(f.x + TILE / 2, TILE / 2);
            homeFlash = 1.2;
            buildLanes(state.level);
            resetFrog();
        } else {
            sounds.hop();
        }
        setBest();
    }

    /**
     * Creates one firework burst: a ring of particles flying out in random directions.
     * @param {number} x - Burst center in canvas pixels.
     * @param {number} y - Burst center in canvas pixels.
     */
    function spawnBurst(x, y) {
        var colors = ['#ff2bd6', '#39ff14', '#00f0ff', '#fee440', '#ff9f1c'];
        var color = colors[Math.floor(Math.random() * colors.length)];
        for (var i = 0; i < 18; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 60 + Math.random() * 110;
            particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.9, max: 0.9, color: color
            });
        }
    }

    /**
     * Launches three bursts in a row: one where the frog arrived, then two more
     * near it along the top strip.
     * @param {number} x - Where the frog reached the goal, in canvas pixels.
     * @param {number} y - Vertical position of the first burst.
     */
    function spawnFireworks(x, y) {
        spawnBurst(x, y);
        setTimeout(function () { spawnBurst(x - 50 + Math.random() * 100, TILE / 2); }, 200);
        setTimeout(function () { spawnBurst(x - 50 + Math.random() * 100, TILE / 2); }, 400);
    }

    /**
     * Advances the HOME flash timer and firework particles: moves them,
     * applies gravity, and removes particles that have faded out.
     * @param {number} dt - Seconds since the last frame.
     */
    function updateParticles(dt) {
        if (homeFlash > 0) homeFlash = Math.max(0, homeFlash - dt);
        particles.forEach(function (p) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 90 * dt;
            p.life -= dt;
        });
        particles = particles.filter(function (p) { return p.life > 0; });
        marks.forEach(function (m) { m.age += dt; });
        marks = marks.filter(function (m) { return m.age < m.life; });
    }

    /** Draws every firework particle as a glowing dot that fades as it ages. */
    function drawParticles() {
        particles.forEach(function (p) {
            ctx.globalAlpha = Math.max(0, p.life / p.max);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    /**
     * Checks whether two horizontal ranges overlap.
     * @param {{x: number, w: number}} a - First range (left edge and width).
     * @param {{x: number, w: number}} b - Second range (left edge and width).
     * @returns {boolean}
     */
    function overlaps(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x;
    }

    /**
     * Runs one step of the game: moves cars and logs, checks whether the frog was
     * hit by a car or missed a log, and carries the frog along with the log it rides.
     * @param {number} dt - Seconds since the last frame.
     */
    function update(dt) {
        updateParticles(dt);
        if (state.frog && state.frog.hop > 0) state.frog.hop = Math.max(0, state.frog.hop - dt);
        if (state.over) return;
        var step = dt * state.speed;

        Object.keys(lanes).forEach(function (row) {
            var lane = lanes[row];
            lane.items.forEach(function (it) {
                it.x = wrap(it.x + lane.speed * step);
            });
        });

        var f = state.frog;
        var cx = f.x + TILE / 2;
        var lane = lanes[f.row];

        if (!lane) return;

        if (lane.road) {
            var body = { x: f.x + 10, w: TILE - 20 };
            for (var i = 0; i < lane.items.length; i++) {
                if (overlaps(body, lane.items[i])) {
                    die('splat');
                    return;
                }
            }
        } else {
            var log = null;
            for (var j = 0; j < lane.items.length; j++) {
                var it = lane.items[j];
                if (cx >= it.x && cx <= it.x + it.w) {
                    log = it;
                    break;
                }
            }
            if (!log) {
                die('splash');
                return;
            }
            f.x += lane.speed * step;
            cx = f.x + TILE / 2;
            if (cx < 0 || cx > W) die('splash');
        }
    }

    /** Paints the background: HOME strip, safe grass, road with lane dashes, and river with ripples. */
    function drawGrid() {
        for (var row = 0; row < ROWS; row++) {
            var y = row * TILE;
            if (row === 0) {
                ctx.fillStyle = '#ff2bd6';
            } else if (row === START_ROW || row === 6) {
                ctx.fillStyle = '#0f7a3a';
            } else if (ROAD_ROWS.indexOf(row) !== -1) {
                ctx.fillStyle = '#1c1f3a';
            } else {
                ctx.fillStyle = '#0047ff';
            }
            ctx.fillRect(0, y, W, TILE);
            if (row === 0) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 20px system-ui, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                if (homeFlash <= 0 || Math.floor((1.2 - homeFlash) / 0.2) % 2 === 0) {
                    ctx.fillText('HOME', W / 2, y + TILE / 2 + 1);
                }
                ctx.textAlign = 'start';
                ctx.textBaseline = 'alphabetic';
            }

            if (ROAD_ROWS.indexOf(row) !== -1) {
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                for (var x = 0; x < W; x += 40) {
                    ctx.fillRect(x + 8, y + TILE / 2 - 1, 20, 2);
                }
            }
            if (RIVER_ROWS.indexOf(row) !== -1) {
                ctx.fillStyle = 'rgba(0,240,255,0.6)';
                for (var rx = 0; rx < W; rx += 60) {
                    ctx.fillRect(rx + (row * 13) % 40, y + 12, 18, 2);
                    ctx.fillRect(rx + (row * 7) % 50, y + 28, 14, 2);
                }
            }
        }
    }

    /**
     * Fills a rectangle with rounded corners using the current fill style.
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     * @param {number} w - Width.
     * @param {number} h - Height.
     * @param {number} r - Corner radius.
     */
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Lightens or darkens a hex color.
     * @param {string} hex - Color such as '#ff9f1c'.
     * @param {number} amt - From -1 (black) to 1 (white).
     * @returns {string} An rgb() color.
     */
    function shade(hex, amt) {
        var n = parseInt(hex.slice(1), 16);
        var ch = [n >> 16, (n >> 8) & 255, n & 255].map(function (c) {
            return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
        });
        return 'rgb(' + ch.join(',') + ')';
    }

    /**
     * Draws one top-down car at its position, with the front facing the direction of travel:
     * a shadow, wheels, shaded body, roof, glass, headlights with a light beam, and taillights.
     * @param {{x: number, w: number, color: string, stripe: boolean}} it - The car.
     * @param {number} y - Top of the lane in canvas pixels.
     * @param {number} dirSign - 1 when driving right, -1 when driving left.
     */
    function drawCar(it, y, dirSign) {
        var hw = it.w / 2;
        var hh = 12;
        ctx.save();
        ctx.translate(it.x + hw, y + TILE / 2);
        ctx.scale(dirSign, 1);

        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        roundRect(-hw + 2, -hh + 3, it.w - 2, hh * 2, 8);

        var beam = ctx.createLinearGradient(hw - 2, 0, hw + 34, 0);
        beam.addColorStop(0, 'rgba(255,247,190,0.35)');
        beam.addColorStop(1, 'rgba(255,247,190,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(hw - 2, -7);
        ctx.lineTo(hw + 34, -15);
        ctx.lineTo(hw + 34, 15);
        ctx.lineTo(hw - 2, 7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#0b0b10';
        [-hw + 9, hw - 21].forEach(function (wx) {
            ctx.fillRect(wx, -hh - 2, 12, 5);
            ctx.fillRect(wx, hh - 3, 12, 5);
        });

        var body = ctx.createLinearGradient(0, -hh, 0, hh);
        body.addColorStop(0, shade(it.color, 0.35));
        body.addColorStop(0.35, it.color);
        body.addColorStop(1, shade(it.color, -0.45));
        ctx.fillStyle = body;
        ctx.shadowColor = it.color;
        ctx.shadowBlur = 8;
        roundRect(-hw, -hh, it.w, hh * 2, 8);
        ctx.shadowBlur = 0;

        if (it.stripe) {
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(-hw + 6, -2, it.w - 12, 1.8);
            ctx.fillRect(-hw + 6, 1, it.w - 12, 1.8);
        }

        ctx.fillStyle = shade(it.color, -0.25);
        roundRect(-14, -9, 26, 18, 5);
        var roof = ctx.createLinearGradient(0, -9, 0, 9);
        roof.addColorStop(0, shade(it.color, 0.25));
        roof.addColorStop(1, shade(it.color, -0.3));
        ctx.fillStyle = roof;
        roundRect(-11, -7, 20, 14, 4);

        var glass = ctx.createLinearGradient(0, -9, 0, 9);
        glass.addColorStop(0, '#bdeeff');
        glass.addColorStop(1, '#2a6f9a');
        ctx.fillStyle = glass;
        ctx.beginPath();
        ctx.moveTo(10, -8);
        ctx.lineTo(19, -10);
        ctx.lineTo(19, 10);
        ctx.lineTo(10, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1f4f73';
        ctx.beginPath();
        ctx.moveTo(-12, -7);
        ctx.lineTo(-19, -9);
        ctx.lineTo(-19, 9);
        ctx.lineTo(-12, 7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff7be';
        ctx.shadowColor = '#fff7be';
        ctx.shadowBlur = 8;
        [-7, 7].forEach(function (hy) {
            ctx.beginPath();
            ctx.arc(hw - 3, hy, 2.6, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = '#ff1a1a';
        ctx.shadowColor = '#ff1a1a';
        [-8, 8].forEach(function (ty) {
            ctx.fillRect(-hw + 1, ty - 2, 3, 4);
        });
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    /**
     * Draws one top-down log: a soft shadow and foam on the water, a barrel-shaded trunk,
     * bark grooves, knots, and lighter end caps with growth rings.
     * @param {{x: number, w: number, seed: number}} it - The log.
     * @param {number} y - Top of the lane in canvas pixels.
     */
    function drawLog(it, y) {
        var x = it.x;
        var w = it.w;
        var top = y + 6;
        var h = TILE - 12;

        ctx.fillStyle = 'rgba(0,15,60,0.45)';
        roundRect(x + 3, top + 4, w, h, 10);

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, top - 2);
        ctx.lineTo(x + w - 8, top - 2);
        ctx.moveTo(x + 8, top + h + 2);
        ctx.lineTo(x + w - 8, top + h + 2);
        ctx.stroke();

        var bark = ctx.createLinearGradient(0, top, 0, top + h);
        bark.addColorStop(0, '#4a2a12');
        bark.addColorStop(0.3, '#a06a32');
        bark.addColorStop(0.55, '#8a5726');
        bark.addColorStop(1, '#3d2210');
        ctx.fillStyle = bark;
        roundRect(x, top, w, h, 10);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 8, top, w - 16, h);
        ctx.clip();
        ctx.lineWidth = 1;
        for (var i = 0; i < 6; i++) {
            var gy = top + 4 + i * ((h - 8) / 5);
            ctx.strokeStyle = i % 2 ? 'rgba(30,15,5,0.45)' : 'rgba(255,215,160,0.18)';
            ctx.beginPath();
            ctx.moveTo(x + 8, gy);
            for (var gx = x + 8; gx < x + w - 8; gx += 12) {
                ctx.lineTo(gx + 12, gy + Math.sin(gx * 0.3 + it.seed + i) * 1.2);
            }
            ctx.stroke();
        }
        [0.25, 0.62].forEach(function (p, k) {
            var kx = x + w * (p + (((it.seed * (k + 3)) % 10) / 100));
            var ky = top + h * (k ? 0.68 : 0.32);
            ctx.fillStyle = '#2b1608';
            ctx.beginPath();
            ctx.ellipse(kx, ky, 4.5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,215,160,0.3)';
            ctx.beginPath();
            ctx.ellipse(kx, ky, 6.5, 4.5, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();

        [x + 6, x + w - 6].forEach(function (ex) {
            var cap = ctx.createRadialGradient(ex, top + h / 2, 1, ex, top + h / 2, h / 2);
            cap.addColorStop(0, '#e8c48a');
            cap.addColorStop(1, '#b07a3e');
            ctx.fillStyle = cap;
            ctx.beginPath();
            ctx.ellipse(ex, top + h / 2, 6, h / 2 - 1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(90,50,20,0.7)';
            ctx.lineWidth = 1;
            [0.3, 0.6].forEach(function (s) {
                ctx.beginPath();
                ctx.ellipse(ex, top + h / 2, 6 * s, (h / 2 - 1) * s, 0, 0, Math.PI * 2);
                ctx.stroke();
            });
        });
    }

    /** Draws the cars and the logs. */
    function drawObjects() {
        Object.keys(lanes).forEach(function (row) {
            var lane = lanes[row];
            var y = row * TILE;
            lane.items.forEach(function (it) {
                if (lane.road) drawCar(it, y, lane.speed > 0 ? 1 : -1);
                else drawLog(it, y);
            });
        });
    }

    /**
     * Draws the frog as a top-down frog with a glow. The drawing is rotated to match the
     * direction of the last hop and stretches briefly while the hop animation plays.
     */
    function drawFrog() {
        var f = state.frog;
        var cx = f.x + TILE / 2;
        var cy = f.row * TILE + TILE / 2;
        var ext = f.hop > 0 ? f.hop / HOP_TIME : 0;
        var skin = ctx.createRadialGradient(0, -2, 2, 0, 2, 16);
        skin.addColorStop(0, '#a6ff3d');
        skin.addColorStop(0.55, '#39ff14');
        skin.addColorStop(1, '#1fae1f');

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(f.angle);
        ctx.scale(0.9 * (1 - 0.1 * ext), 0.9 * (1 + 0.18 * ext));

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 14;

        [-1, 1].forEach(function (s) {
            ctx.strokeStyle = '#2bd61a';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(s * 7, 3);
            ctx.lineTo(s * (13 - 4 * ext), 9 + 4 * ext);
            ctx.lineTo(s * (10 - 3 * ext), 15 + 5 * ext);
            ctx.stroke();

            var fx = s * (10 - 3 * ext);
            var fy = 15 + 5 * ext;
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = '#7dff4a';
            [-0.7, 0, 0.7].forEach(function (a) {
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx + Math.sin(a + s * 0.3) * 6, fy + Math.cos(a) * 5);
                ctx.stroke();
            });

            ctx.lineWidth = 3.2;
            ctx.strokeStyle = '#2bd61a';
            ctx.beginPath();
            ctx.moveTo(s * 6, -5);
            ctx.lineTo(s * 11, -2 - 2 * ext);
            ctx.lineTo(s * 12, -7 - 3 * ext);
            ctx.stroke();

            ctx.lineWidth = 1.4;
            ctx.strokeStyle = '#7dff4a';
            [-0.5, 0.1, 0.7].forEach(function (a) {
                ctx.beginPath();
                ctx.moveTo(s * 12, -7 - 3 * ext);
                ctx.lineTo(s * 12 + Math.sin(a) * 4, -7 - 3 * ext - Math.cos(a) * 3.5);
                ctx.stroke();
            });
        });

        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.ellipse(0, 3, 10, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, -9, 8, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(190,255,120,0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(0, 12);
        ctx.stroke();

        ctx.fillStyle = 'rgba(10,90,20,0.55)';
        [[-5, -1, 3, 2.2], [5, 2, 3, 2.4], [-4, 7, 2.6, 2], [4.5, -4, 2.2, 1.8], [-6, 3, 1.8, 1.6]].forEach(function (p) {
            ctx.beginPath();
            ctx.ellipse(p[0], p[1], p[2], p[3], 0, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.strokeStyle = 'rgba(10,90,20,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -11.5, 5, 0.25 * Math.PI, 0.75 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = 'rgba(10,70,20,0.9)';
        ctx.beginPath();
        ctx.arc(-2, -15.5, 0.8, 0, Math.PI * 2);
        ctx.arc(2, -15.5, 0.8, 0, Math.PI * 2);
        ctx.fill();

        [-1, 1].forEach(function (s) {
            ctx.fillStyle = '#2bd61a';
            ctx.beginPath();
            ctx.arc(s * 6, -13, 4.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffd43b';
            ctx.beginPath();
            ctx.arc(s * 6, -13, 3.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.ellipse(s * 6, -13, 0.9, 2.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(s * 6 - 1, -14.3, 0.8, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    }

    /** Dims the board and shows the Game over message with the final score. */
    function drawOverlay() {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff2bd6';
        ctx.font = 'bold 36px system-ui, Arial, sans-serif';
        ctx.fillText('Game over', W / 2, H / 2 - 20);
        ctx.fillStyle = '#e5e7eb';
        ctx.font = '16px system-ui, Arial, sans-serif';
        ctx.fillText('Score ' + state.score + '. Press Enter or R to play again.', W / 2, H / 2 + 16);
        ctx.textAlign = 'start';
    }

    /** Draws one complete frame (board, cars and logs, frog, fireworks, overlay) and updates the score display. */
    function render() {
        ctx.clearRect(0, 0, W, H);
        ctx.shadowBlur = 0;
        drawGrid();
        drawMarks();
        drawObjects();
        if (!state.frog.dead) drawFrog();
        drawParticles();
        if (state.over) drawOverlay();

        scoreEl.textContent = state.score;
        livesEl.textContent = state.lives;
        levelEl.textContent = state.level;
        bestEl.textContent = best;
    }

    var last = 0;

    /**
     * The game loop, called by the browser before each repaint. Updates the game,
     * draws it, and schedules the next frame. Time steps are capped so the game
     * does not jump ahead after the tab was in the background.
     * @param {number} ts - Timestamp in milliseconds supplied by requestAnimationFrame.
     */
    function frame(ts) {
        var dt = Math.min((ts - last) / 1000, 0.05);
        last = ts;
        update(dt);
        render();
        requestAnimationFrame(frame);
    }

    // Keyboard keys mapped to [columns, rows] hop directions (arrow keys and WASD).
    var KEYS = {
        ArrowUp: [0, 1], w: [0, 1], W: [0, 1],
        ArrowDown: [0, -1], s: [0, -1], S: [0, -1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
    };

    // Handles key presses: Enter, Space, or R restarts after game over; arrows and WASD hop the frog.
    document.addEventListener('keydown', function (e) {
        getAudio();
        if (state.over && (e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R')) {
            e.preventDefault();
            newGame();
            return;
        }
        var move = KEYS[e.key];
        if (move) {
            e.preventDefault();
            hop(move[0], move[1]);
        }
    });

    // On-screen arrow buttons mapped to the same hop directions as the keyboard.
    var DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };

    // Wires up the touch arrow pad: tapping a button hops the frog, or restarts after game over.
    document.querySelectorAll('.pad__btn').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            getAudio();
            if (state.over) {
                newGame();
                return;
            }
            var d = DIRS[btn.getAttribute('data-dir')];
            hop(d[0], d[1]);
        });
    });

    // Where a touch or click on the board began, used to detect swipes.
    var touchStart = null;

    // Remembers where a touch or click on the board started, and unlocks audio.
    canvas.addEventListener('pointerdown', function (e) {
        getAudio();
        touchStart = { x: e.clientX, y: e.clientY };
    });

    // Turns a swipe on the board into a hop in that direction; a short tap hops forward.
    // After game over, any tap starts a new game.
    canvas.addEventListener('pointerup', function (e) {
        if (!touchStart) return;
        var dx = e.clientX - touchStart.x;
        var dy = e.clientY - touchStart.y;
        touchStart = null;
        if (state.over) {
            newGame();
            return;
        }
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
            hop(0, 1);
        } else if (Math.abs(dx) > Math.abs(dy)) {
            hop(dx > 0 ? 1 : -1, 0);
        } else {
            hop(0, dy > 0 ? -1 : 1);
        }
    });

    // "New game" button: starts over but keeps the saved best score.
    restartBtn.addEventListener('click', function () {
        newGame();
        canvas.focus();
    });

    // "Reset progress" button: clears the saved best score and starts a new game.
    resetBtn.addEventListener('click', function () {
        best = 0;
        localStorage.removeItem('frogger-best');
        newGame();
        canvas.focus();
    });

    // Sound button: toggles mute and remembers the choice in localStorage.
    soundBtn.addEventListener('click', function () {
        muted = !muted;
        localStorage.setItem('frogger-muted', String(muted));
        updateSoundButton();
        if (!muted) getAudio();
    });

    // Start-up: sync the Sound button, set up the first game, and start the game loop.
    updateSoundButton();
    newGame();
    requestAnimationFrame(function (ts) {
        last = ts;
        requestAnimationFrame(frame);
    });
})();
