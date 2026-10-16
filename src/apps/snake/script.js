/*! Copyright (c) 2025-2026 Digitalus Maximus. All rights reserved. https://digitalus.github.io */
(function () {
    var CELL = 24;
    var COLS = 20;
    var ROWS = 20;
    var W = COLS * CELL;
    var H = ROWS * CELL;
    var START_STEP = 0.14;
    var MIN_STEP = 0.06;
    var FOOD_PER_LEVEL = 5;
    var FOOD_COLORS = ['#ff2e63', '#ff9f1c', '#00f5d4', '#fee440', '#9b5de5'];

    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    var scoreEl = document.getElementById('score');
    var levelEl = document.getElementById('level');
    var bestEl = document.getElementById('best');
    var restartBtn = document.getElementById('restart');
    var resetBtn = document.getElementById('reset');
    var soundBtn = document.getElementById('sound');
    var pauseBtn = document.getElementById('pause');

    var best = Number(localStorage.getItem('snake-best') || 0);
    var muted = localStorage.getItem('snake-muted') === 'true';

    var snake, dir, queue, food, eaten, score, level, state, acc, clock, particles;
    var audio = null;

    /**
     * Returns the shared Web Audio context, creating it on first use and
     * resuming it if the browser suspended it (browsers require a user gesture first).
     * @returns {AudioContext}
     */
    function getAudio() {
        if (!audio) {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            audio = new Ctx();
        }
        if (audio.state === 'suspended') audio.resume();
        return audio;
    }

    /**
     * Plays a short synthesized note that fades out, optionally sliding in pitch.
     * Does nothing while sound is muted.
     * @param {number} freq - Starting frequency in Hz.
     * @param {number} dur - Length in seconds.
     * @param {string} type - Oscillator wave shape (sine, square, sawtooth, triangle).
     * @param {number} vol - Starting volume from 0 to 1.
     * @param {number} [slideTo] - Frequency in Hz to glide toward over the note.
     * @param {number} [delay] - Seconds to wait before the note starts.
     */
    function tone(freq, dur, type, vol, slideTo, delay) {
        if (muted) return;
        var a = getAudio();
        if (!a) return;
        var t = a.currentTime + (delay || 0);
        var osc = a.createOscillator();
        var gain = a.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(a.destination);
        osc.start(t);
        osc.stop(t + dur);
    }

    // Sound effects for game events, all synthesized with the helper above.
    var sounds = {
        // Bright blip when food is eaten; pitch rises a little with each level.
        eat: function () { tone(500 + level * 30, 0.1, 'square', 0.08, 900 + level * 30); },
        // Rising three-note jingle when a new level starts.
        levelUp: function () {
            tone(520, 0.12, 'triangle', 0.12, null, 0.05);
            tone(660, 0.12, 'triangle', 0.12, null, 0.17);
            tone(880, 0.2, 'triangle', 0.12, null, 0.29);
        },
        // Slow falling tones when the snake runs into itself.
        over: function () {
            tone(330, 0.25, 'sawtooth', 0.1, 220);
            tone(247, 0.25, 'sawtooth', 0.1, 165, 0.22);
            tone(185, 0.5, 'sawtooth', 0.1, 90, 0.44);
        }
    };

    /** Updates the Sound button label and its aria-pressed state to match the muted setting. */
    function updateSoundButton() {
        soundBtn.textContent = 'Sound: ' + (muted ? 'Off' : 'On');
        soundBtn.setAttribute('aria-pressed', String(!muted));
    }

    /** Updates the Pause button label to match the game state. */
    function updatePauseButton() {
        pauseBtn.textContent = state === 'paused' ? 'Resume' : 'Pause';
    }

    /**
     * Returns the seconds between snake moves for a level. The step shrinks
     * every level until it reaches the fastest allowed speed.
     * @param {number} lv - The level, starting at 1.
     * @returns {number}
     */
    function stepTime(lv) {
        return Math.max(MIN_STEP, START_STEP - (lv - 1) * 0.008);
    }

    /** Places the food on a random empty cell. */
    function placeFood() {
        var free = [];
        var taken = {};
        snake.forEach(function (s) { taken[s.x + ',' + s.y] = true; });
        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x < COLS; x++) {
                if (!taken[x + ',' + y]) free.push({ x: x, y: y });
            }
        }
        if (!free.length) { food = null; return; }
        var spot = free[Math.floor(Math.random() * free.length)];
        food = { x: spot.x, y: spot.y, color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)] };
    }

    /** Starts a fresh game: a three-segment snake, zero score, level 1, and waiting for the first move. */
    function newGame() {
        var cy = Math.floor(ROWS / 2);
        snake = [{ x: 10, y: cy }, { x: 9, y: cy }, { x: 8, y: cy }];
        dir = { x: 1, y: 0 };
        queue = [];
        eaten = 0;
        score = 0;
        level = 1;
        acc = 0;
        particles = [];
        state = 'ready';
        placeFood();
        updatePauseButton();
    }

    /** Saves the score as the new best score (in localStorage) if it beats the old one. */
    function setBest() {
        if (score > best) {
            best = score;
            localStorage.setItem('snake-best', String(best));
        }
    }

    /**
     * Queues a turn. Turns are buffered (up to two) so quick key presses are not lost,
     * and a turn straight back onto the snake's own body is ignored.
     * Any direction also starts the game from the ready state.
     * @param {number} dx - Horizontal direction (-1, 0, or 1).
     * @param {number} dy - Vertical direction (-1, 0, or 1).
     */
    function steer(dx, dy) {
        if (state === 'over') return;
        if (state === 'paused') return;
        var ref = queue.length ? queue[queue.length - 1] : dir;
        if (dx === -ref.x && dy === -ref.y) return;
        if (dx === ref.x && dy === ref.y) {
            if (state === 'ready') state = 'playing';
            return;
        }
        if (queue.length < 2) queue.push({ x: dx, y: dy });
        if (state === 'ready') state = 'playing';
    }

    /** Pauses a running game or resumes a paused one. */
    function togglePause() {
        if (state === 'playing') state = 'paused';
        else if (state === 'paused') state = 'playing';
        updatePauseButton();
    }

    /**
     * Creates a burst of glowing particles flying out from a cell.
     * @param {number} cx - Cell column.
     * @param {number} cy - Cell row.
     * @param {string} color - Particle color.
     */
    function spawnBurst(cx, cy, color) {
        for (var i = 0; i < 14; i++) {
            var ang = Math.random() * Math.PI * 2;
            var sp = 40 + Math.random() * 90;
            particles.push({
                x: cx * CELL + CELL / 2,
                y: cy * CELL + CELL / 2,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                life: 0.5 + Math.random() * 0.3,
                age: 0,
                color: color
            });
        }
    }

    /**
     * Moves the particles and removes those that have faded out.
     * @param {number} dt - Seconds since the last frame.
     */
    function updateParticles(dt) {
        particles = particles.filter(function (p) {
            p.age += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            return p.age < p.life;
        });
    }

    /** Ends the game: plays the sound and saves the best score. */
    function gameOver() {
        state = 'over';
        setBest();
        sounds.over();
        updatePauseButton();
    }

    /**
     * Advances the snake one cell. The edges wrap to the opposite side.
     * Running into the body ends the game; eating food grows the snake,
     * scores points, and speeds the game up every few foods.
     */
    function step() {
        if (queue.length) dir = queue.shift();
        var head = snake[0];
        var nx = (head.x + dir.x + COLS) % COLS;
        var ny = (head.y + dir.y + ROWS) % ROWS;
        var ate = food && nx === food.x && ny === food.y;
        var body = ate ? snake : snake.slice(0, -1);
        for (var i = 0; i < body.length; i++) {
            if (body[i].x === nx && body[i].y === ny) { gameOver(); return; }
        }
        snake.unshift({ x: nx, y: ny });
        if (!ate) { snake.pop(); return; }
        spawnBurst(nx, ny, food.color);
        eaten++;
        score += 10 * level;
        var newLevel = 1 + Math.floor(eaten / FOOD_PER_LEVEL);
        if (newLevel > level) { level = newLevel; sounds.levelUp(); } else { sounds.eat(); }
        setBest();
        placeFood();
    }

    /**
     * Runs one frame of game logic: moves the snake on a timer that gets
     * shorter as the level rises, and animates particles.
     * @param {number} dt - Seconds since the last frame.
     */
    function update(dt) {
        updateParticles(dt);
        if (state !== 'playing') return;
        acc += dt;
        var s = stepTime(level);
        while (acc >= s && state === 'playing') {
            acc -= s;
            step();
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

    /** Paints the dark board with a faint neon grid. */
    function drawGrid() {
        ctx.fillStyle = '#05050d';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var x = 1; x < COLS; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, H); }
        for (var y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(W, y * CELL + 0.5); }
        ctx.stroke();
    }

    /** Draws the food as a pulsing glowing dot. */
    function drawFood() {
        if (!food) return;
        var pulse = 1 + Math.sin(clock * 6) * 0.12;
        var r = (CELL / 2 - 4) * pulse;
        ctx.save();
        ctx.shadowColor = food.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = food.color;
        ctx.beginPath();
        ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /** Draws the snake as glowing rounded segments that fade toward the tail, with eyes on the head. */
    function drawSnake() {
        ctx.save();
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 12;
        for (var i = snake.length - 1; i >= 0; i--) {
            var s = snake[i];
            var fade = 1 - (i / Math.max(snake.length, 8)) * 0.55;
            ctx.fillStyle = 'rgba(57, 255, 20, ' + fade.toFixed(2) + ')';
            roundRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4, 6);
        }
        ctx.restore();
        var h = snake[0];
        var cx = h.x * CELL + CELL / 2;
        var cy = h.y * CELL + CELL / 2;
        var px = -dir.y;
        var py = dir.x;
        ctx.fillStyle = '#05050d';
        [-1, 1].forEach(function (side) {
            ctx.beginPath();
            ctx.arc(cx + dir.x * 4 + px * side * 5, cy + dir.y * 4 + py * side * 5, 2.4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /** Draws every particle as a glowing dot that fades as it ages. */
    function drawParticles() {
        ctx.save();
        particles.forEach(function (p) {
            ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    /**
     * Dims the board and shows a centered message with an optional smaller line.
     * @param {string} title - Large heading text.
     * @param {string} [sub] - Smaller line below the heading.
     * @param {string} color - Heading color.
     */
    function drawOverlay(title, sub, color) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.font = 'bold 40px system-ui, sans-serif';
        ctx.fillText(title, W / 2, H / 2 - 6);
        ctx.shadowBlur = 0;
        if (sub) {
            ctx.fillStyle = '#e5e7eb';
            ctx.font = '18px system-ui, sans-serif';
            ctx.fillText(sub, W / 2, H / 2 + 28);
        }
    }

    /** Draws one complete frame (board, food, snake, particles, overlays) and updates the score display. */
    function render() {
        drawGrid();
        drawFood();
        drawSnake();
        drawParticles();
        if (state === 'ready') drawOverlay('Ready?', 'Press an arrow key or swipe to start', '#39ff14');
        else if (state === 'paused') drawOverlay('Paused', 'Press Space or P to resume', '#00f0ff');
        else if (state === 'over') drawOverlay('Game over', 'Score ' + score + '. Tap or press Enter to play again', '#ff2e63');
        scoreEl.textContent = score;
        levelEl.textContent = level;
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
        var dt = Math.min(0.05, (ts - last) / 1000 || 0);
        last = ts;
        clock += dt;
        update(dt);
        render();
        requestAnimationFrame(frame);
    }

    // Keyboard keys mapped to [columns, rows] directions (arrow keys and WASD).
    var KEYS = {
        ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
    };

    // Handles key presses: Enter or R restarts after game over; Space or P pauses; arrows and WASD steer.
    document.addEventListener('keydown', function (e) {
        getAudio();
        if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
            e.preventDefault();
            if (state === 'over') { newGame(); return; }
            togglePause();
            return;
        }
        if (state === 'over' && (e.key === 'Enter' || e.key === 'r' || e.key === 'R')) {
            newGame();
            return;
        }
        var d = KEYS[e.key];
        if (d) {
            e.preventDefault();
            steer(d[0], d[1]);
        }
    });

    // On-screen arrow buttons mapped to the same directions as the keyboard.
    var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

    // Wires up the touch arrow pad: tapping a button steers, or restarts after game over.
    document.querySelectorAll('.pad__btn').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            getAudio();
            if (state === 'over') { newGame(); return; }
            var d = DIRS[btn.getAttribute('data-dir')];
            steer(d[0], d[1]);
        });
    });

    // Where a touch or click on the board began, used to detect swipes.
    var touchStart = null;

    // Remembers where a touch or click on the board started, and unlocks audio.
    canvas.addEventListener('pointerdown', function (e) {
        getAudio();
        touchStart = { x: e.clientX, y: e.clientY };
    });

    // Turns a swipe on the board into a turn in that direction. A tap restarts after
    // game over, and resumes a paused game.
    canvas.addEventListener('pointerup', function (e) {
        if (!touchStart) return;
        var dx = e.clientX - touchStart.x;
        var dy = e.clientY - touchStart.y;
        touchStart = null;
        if (state === 'over') { newGame(); return; }
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
            if (state === 'paused') togglePause();
            return;
        }
        if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0);
        else steer(0, dy > 0 ? 1 : -1);
    });

    // Cancels a swipe if the browser takes over the touch.
    canvas.addEventListener('pointercancel', function () { touchStart = null; });

    // Pauses automatically when the tab is hidden so the snake does not keep moving unseen.
    document.addEventListener('visibilitychange', function () {
        if (document.hidden && state === 'playing') togglePause();
    });

    // Pause button: pauses or resumes a running game.
    pauseBtn.addEventListener('click', function () {
        togglePause();
        pauseBtn.blur();
    });

    // "New game" button: starts over but keeps the saved best score.
    restartBtn.addEventListener('click', function () {
        getAudio();
        newGame();
        restartBtn.blur();
    });

    // "Reset progress" button: clears the saved best score and starts a new game.
    resetBtn.addEventListener('click', function () {
        best = 0;
        localStorage.removeItem('snake-best');
        newGame();
        resetBtn.blur();
    });

    // Sound button: toggles mute and remembers the choice in localStorage.
    soundBtn.addEventListener('click', function () {
        muted = !muted;
        localStorage.setItem('snake-muted', String(muted));
        updateSoundButton();
        if (!muted) getAudio();
        soundBtn.blur();
    });

    // Start-up: sync the Sound button, set up the first game, and start the game loop.
    clock = 0;
    updateSoundButton();
    newGame();
    requestAnimationFrame(frame);
})();
