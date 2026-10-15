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

    function getAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

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

    var sounds = {
        hop: function () { tone(360, 0.11, 'sine', 0.14, 620); },
        splat: function () {
            noise(0.35, 0.5, 700);
            tone(150, 0.3, 'sine', 0.18, 45);
        },
        goal: function () {
            [523, 659, 784, 1047].forEach(function (freq, i) {
                setTimeout(function () { tone(freq, 0.18, 'triangle', 0.14); }, i * 110);
            });
        },
        over: function () {
            [392, 349, 311, 262].forEach(function (freq, i) {
                setTimeout(function () { tone(freq, 0.3, 'triangle', 0.14); }, i * 260);
            });
        }
    };

    function updateSoundButton() {
        soundBtn.textContent = 'Sound: ' + (muted ? 'Off' : 'On');
        soundBtn.setAttribute('aria-pressed', String(!muted));
    }

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
                items.push({ x: -TILE + i * LOOP / count, w: width, color: CAR_COLORS[(row + i) % CAR_COLORS.length] });
            }
            lanes[row] = { road: isRoad, speed: SPEEDS[row], items: items };
        });
    }

    function wrap(x) {
        return ((x + TILE) % LOOP + LOOP) % LOOP - TILE;
    }

    function resetFrog() {
        state.frog = { x: START_COL * TILE, row: START_ROW, angle: 0, hop: 0 };
    }

    function newGame() {
        state = { lives: LIVES, score: 0, level: 1, speed: 1, over: false };
        particles = [];
        homeFlash = 0;
        buildLanes(1);
        resetFrog();
    }

    function setBest() {
        if (state.score > best) {
            best = state.score;
            localStorage.setItem('frogger-best', String(best));
        }
    }

    function die() {
        if (state.over) return;
        state.lives--;
        sounds.splat();
        if (state.lives <= 0) {
            state.over = true;
            setBest();
            sounds.over();
        } else {
            resetFrog();
        }
    }

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

    function spawnFireworks(x, y) {
        spawnBurst(x, y);
        setTimeout(function () { spawnBurst(x - 50 + Math.random() * 100, TILE / 2); }, 200);
        setTimeout(function () { spawnBurst(x - 50 + Math.random() * 100, TILE / 2); }, 400);
    }

    function updateParticles(dt) {
        if (homeFlash > 0) homeFlash = Math.max(0, homeFlash - dt);
        particles.forEach(function (p) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 90 * dt;
            p.life -= dt;
        });
        particles = particles.filter(function (p) { return p.life > 0; });
    }

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

    function overlaps(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x;
    }

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
                    die();
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
                die();
                return;
            }
            f.x += lane.speed * step;
            cx = f.x + TILE / 2;
            if (cx < 0 || cx > W) die();
        }
    }

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

    function drawObjects() {
        Object.keys(lanes).forEach(function (row) {
            var lane = lanes[row];
            var y = row * TILE;
            lane.items.forEach(function (it) {
                if (lane.road) {
                    ctx.fillStyle = it.color;
                    ctx.shadowColor = it.color;
                    ctx.shadowBlur = 16;
                    roundRect(it.x, y + 8, it.w, TILE - 16, 8);
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = 'rgba(20,20,30,0.55)';
                    var front = lane.speed > 0 ? it.x + it.w - 14 : it.x + 4;
                    ctx.fillRect(front, y + 13, 10, TILE - 26);
                } else {
                    ctx.fillStyle = '#ff9f1c';
                    ctx.shadowColor = '#ff9f1c';
                    ctx.shadowBlur = 14;
                    roundRect(it.x, y + 6, it.w, TILE - 12, 6);
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = 'rgba(0,0,0,0.25)';
                    for (var gx = it.x + 16; gx < it.x + it.w - 8; gx += 28) {
                        ctx.fillRect(gx, y + 12, 2, TILE - 24);
                    }
                }
            });
        });
    }

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

    function render() {
        ctx.clearRect(0, 0, W, H);
        ctx.shadowBlur = 0;
        drawGrid();
        drawObjects();
        drawFrog();
        drawParticles();
        if (state.over) drawOverlay();

        scoreEl.textContent = state.score;
        livesEl.textContent = state.lives;
        levelEl.textContent = state.level;
        bestEl.textContent = best;
    }

    var last = 0;
    function frame(ts) {
        var dt = Math.min((ts - last) / 1000, 0.05);
        last = ts;
        update(dt);
        render();
        requestAnimationFrame(frame);
    }

    var KEYS = {
        ArrowUp: [0, 1], w: [0, 1], W: [0, 1],
        ArrowDown: [0, -1], s: [0, -1], S: [0, -1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
    };

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

    var DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };

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

    var touchStart = null;

    canvas.addEventListener('pointerdown', function (e) {
        getAudio();
        touchStart = { x: e.clientX, y: e.clientY };
    });

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

    restartBtn.addEventListener('click', function () {
        newGame();
        canvas.focus();
    });

    resetBtn.addEventListener('click', function () {
        best = 0;
        localStorage.removeItem('frogger-best');
        newGame();
        canvas.focus();
    });

    soundBtn.addEventListener('click', function () {
        muted = !muted;
        localStorage.setItem('frogger-muted', String(muted));
        updateSoundButton();
        if (!muted) getAudio();
    });

    updateSoundButton();
    newGame();
    requestAnimationFrame(function (ts) {
        last = ts;
        requestAnimationFrame(frame);
    });
})();
