(function () {
  "use strict";
  window.NS = window.NS || {};

  const BLOCK_H = 30;
const REF_W = 500;

  const DIFFICULTIES = {
    easy: { startSpeed: 130, stepInterval: 3, stepIncrement: 12, maxSpeed: 320, perfectThreshold: 8, initialWidthMulti: 1.15, regrow: 3 },
    medium: { startSpeed: 160, stepInterval: 3, stepIncrement: 18, maxSpeed: 460, perfectThreshold: 5, initialWidthMulti: 1.0, regrow: 2 },
    hard: { startSpeed: 200, stepInterval: 3, stepIncrement: 26, maxSpeed: 700, perfectThreshold: 3, initialWidthMulti: 0.9, regrow: 1 }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  const Game = function (canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hooks = hooks || {};
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = 0; this.H = 0;
    this.state = "title";
    this.blocks = [];
    this.particles = [];
    this.camY = 0;
    this.camYTarget = 0;
    this.shake = 0;
    this.flash = 0;
    this.mpPendingSounds = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalPerfects = 0;
    this.longestStreak = 0;
    this.difficulty = "medium";
    this.best = 0;
    this.moving = null;
    this.dir = 1;
    this.speed = 120;
    this.initialW = 200;
    this.maxW = 200;
    this.falling = null;
    this.bgPhase = 0;
    this.lastT = 0;
    this.revivedThisRun = false;
    this.groundY = 0;
    this.hueBase = 190;
    this.stars = [];
    this.mode = "normal";
    this.targetScore = 0;
    this.targetPlayer = 1;
    this.remoteState = null;

    this._bindResize();
    this.resize();
  };

  Game.prototype._bindResize = function () {
    const self = this;
    this._onResize = function () { self.resize(); };
    window.addEventListener("resize", this._onResize);
    window.addEventListener("orientationchange", this._onResize);
  };

  Game.prototype.resize = function () {
    const rect = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, Math.floor(rect.width));
    this.H = Math.max(1, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.initialW = Math.max(110, this.W * 0.34);
    this.maxW = this.initialW;
    this.groundY = this.H - 8;
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const drift = 0.01 + Math.random() * 0.06;
      this.stars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        size: 0.3 + Math.random() * 2.2,
        vx: Math.cos(angle) * drift,
        vy: Math.sin(angle) * drift,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.3 + Math.random() * 0.7
      });
    }
  };

  Game.prototype.startLoop = function () {
    if (this._raf) return;
    const self = this;
    this.lastT = performance.now();
    this._raf = function (t) {
      self._frame(t);
    };
    requestAnimationFrame(this._raf);
  };

  Game.prototype._frame = function (t) {
    const dt = Math.min(0.05, (t - this.lastT) / 1000) || 0;
    this.lastT = t;
    this.update(dt);
    this.render();
    requestAnimationFrame(this._raf);
  };

  Game.prototype.setDifficulty = function (level) {
    if (DIFFICULTIES[level]) this.difficulty = level;
  };

  Game.prototype.diff = function () {
    return DIFFICULTIES[this.difficulty] || DIFFICULTIES.medium;
  };

  Game.prototype.startTargetRun = function (player) {
    this.targetPlayer = player || 1;
    this.mode = "target";
    if (player === 1) {
      var storedMode = localStorage.getItem("neonstack_mode");
      if (storedMode && DIFFICULTIES[storedMode]) this.difficulty = storedMode;
      sessionStorage.removeItem("neonstack_target");
    } else {
      this.targetScore = parseInt(sessionStorage.getItem("neonstack_target") || "0", 10) || 0;
      var storedMode = localStorage.getItem("neonstack_mode");
      if (storedMode && DIFFICULTIES[storedMode]) this.difficulty = storedMode;
    }
    this.newRun();
  };

  Game.prototype.newRun = function () {
    this.blocks = [];
    this.particles = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalPerfects = 0;
    this.revivedThisRun = false;
    this.falling = null;
    this.flash = 0;
    this.shake = 0;
    this.speed = 0;
    const d = this.diff();
    const bestKey = "neonstack_best_" + this.difficulty;
    this.best = parseInt(localStorage.getItem(bestKey) || "0", 10) || 0;
    this.longestStreak = parseInt(localStorage.getItem("neonstack_streak_" + this.difficulty) || "0", 10) || 0;
    const baseW = clamp(this.initialW * d.initialWidthMulti, 60, 320);
    const cx = this.W / 2;
    this.blocks.push({ x: cx - baseW / 2, w: baseW, hue: this.hueBase });
    this.camY = 0;
    this.camYTarget = 0;
    this.spawnMoving();
    this.state = "playing";
    this.hooks.onScore && this.hooks.onScore(0);
    this.startLoop();
  };

  Game.prototype.spawnMoving = function () {
    const top = this.blocks[this.blocks.length - 1];
    const w = top.w;
    this.dir = (this.blocks.length % 2 === 0) ? 1 : -1;
    const startX = this.dir === 1 ? 0 : (this.W - w);
    this.moving = { x: startX, w: w, y: 0, hue: (this.hueBase + this.blocks.length * 7) % 360 };
    const d = this.diff();
    const steps = Math.floor((this.blocks.length - 1) / d.stepInterval);
    const baseSpeed = d.startSpeed + steps * d.stepIncrement;
    this.speed = Math.min(d.maxSpeed, baseSpeed) * (this.W / REF_W);
  };

  Game.prototype.topY = function () {
    return this.groundY - this.blocks.length * BLOCK_H;
  };

  Game.prototype.drop = function () {
    if (this.state !== "playing" || !this.moving) return;
    const m = this.moving;
    const below = this.blocks[this.blocks.length - 1];
    const left = Math.max(m.x, below.x);
    const right = Math.min(m.x + m.w, below.x + below.w);
    const overlap = right - left;

    if (overlap <= 0) {
      this.falling = { x: m.x, w: m.w, y: this.topY() - BLOCK_H, vy: 0, hue: m.hue, rot: 0, vr: (this.dir) * 2 };
      this.moving = null;
      this.gameOver();
      return;
    }

    const d = this.diff();
    const diff = m.x - below.x;
    const isPerfect = Math.abs(diff) < d.perfectThreshold * (this.W / REF_W);

    if (isPerfect) {
      this.combo++;
      this.totalPerfects++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const newW = Math.min(this.maxW, below.w + d.regrow * (this.W / REF_W));
      this.blocks.push({ x: below.x, w: newW, hue: m.hue });
      this.flash = 1;
      this.shake = Math.min(10, 4 + this.combo * 0.6);
      NS.audio && NS.audio.perfect(this.combo);
      this.mpPendingSounds.push("perfect");
      this.hooks.onCombo && this.hooks.onCombo(this.combo);
      if (this.combo >= 3) NS.sdk && NS.sdk.available && NS.sdk.happytime();
    } else {
      this.combo = 0;
      this.blocks.push({ x: left, w: overlap, hue: m.hue });
      const trimSide = m.x < below.x ? "left" : "right";
      const trimW = m.w - overlap;
      const tx = trimSide === "left" ? m.x : right;
      this.particles.push({
        x: tx, y: this.topY() - BLOCK_H, w: trimW, h: BLOCK_H,
        vx: (trimSide === "left" ? -1 : 1) * (60 + Math.random() * 40),
        vy: -30 - Math.random() * 40, rot: 0,
        vr: (trimSide === "left" ? -1 : 1) * (2 + Math.random() * 2),
        hue: m.hue, alpha: 1
      });
      this.shake = 3;
      NS.audio && NS.audio.trim();
      this.mpPendingSounds.push("trim");
    }

    this.score++;
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem("neonstack_best_" + this.difficulty, String(this.best));
    }
    this.hooks.onScore && this.hooks.onScore(this.score);
    NS.audio && NS.audio.drop();
    this.mpPendingSounds.push("drop");
    NS.sdk && NS.sdk.available && NS.sdk.setContext({ score: this.score, combo: this.combo });

    this.moving = null;
    this.spawnMoving();
  };

  Game.prototype.gameOver = function () {
    this.state = "gameover";
    this.shake = 14;

    if (this.maxCombo > this.longestStreak) {
      this.longestStreak = this.maxCombo;
      localStorage.setItem("neonstack_streak_" + this.difficulty, String(this.longestStreak));
    }

    NS.audio && NS.audio.gameOver();
    this.mpPendingSounds.push("gameOver");
    NS.sdk && NS.sdk.available && NS.sdk.gameplayStop();

    if (this.mode === "target") {
      if (this.targetPlayer === 1) {
        sessionStorage.setItem("neonstack_target", String(this.score));
        this.hooks.onTargetSet && this.hooks.onTargetSet(this.score);
      } else {
        var passed = this.score >= this.targetScore;
        this.hooks.onTargetResult && this.hooks.onTargetResult(passed, this.score, this.targetScore);
      }
      return;
    }

    this.hooks.onGameOver && this.hooks.onGameOver(this.score, this.best, !this.revivedThisRun && this.score >= 4, this.maxCombo, this.totalPerfects, this.longestStreak);
  };

  Game.prototype.revive = function () {
    if (this.state !== "gameover") return false;
    const top = this.blocks[this.blocks.length - 1];
    const restoreW = Math.max(top.w, this.initialW * 0.7);
    top.w = restoreW;
    top.x = clamp(top.x, 0, this.W - restoreW);
    this.revivedThisRun = true;
    this.falling = null;
    this.state = "playing";
    NS.sdk && NS.sdk.available && NS.sdk.gameplayStart();
    this.spawnMoving();
    return true;
  };

  Game.prototype.returnToMenu = function () {
    this.blocks = [];
    this.particles = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalPerfects = 0;
    this.mode = "normal";
    this.targetPlayer = 1;
    this.targetScore = 0;
    this.falling = null;
    this.moving = null;
    this.state = "title";
    this.shake = 0;
    this.flash = 0;
    this.camY = 0;
    this.camYTarget = 0;
    NS.sdk && NS.sdk.available && NS.sdk.gameplayStop();
    this.hooks.onReturnToMenu && this.hooks.onReturnToMenu();
  };

  Game.prototype.pause = function () {
    if (this.state !== "playing") return;
    this.state = "paused";
    NS.sdk && NS.sdk.available && NS.sdk.gameplayStop();
  };

  Game.prototype.resume = function () {
    if (this.state !== "paused") return;
    this.state = "playing";
    NS.sdk && NS.sdk.available && NS.sdk.gameplayStart();
  };

  Game.prototype.update = function (dt) {
    this.bgPhase += dt * 0.15;

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.x += s.vx * dt * 12;
      s.y += s.vy * dt * 12;
      if (s.x < -4) { s.x = this.W + 4; s.y = Math.random() * this.H; }
      if (s.x > this.W + 4) { s.x = -4; s.y = Math.random() * this.H; }
      if (s.y < -4) { s.y = this.H + 4; s.x = Math.random() * this.W; }
      if (s.y > this.H + 4) { s.y = -4; s.x = Math.random() * this.W; }
    }

    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3.2);

    if (this.state !== "playing") return;

    if (this.moving) {
      const m = this.moving;
      const maxRight = this.W - m.w;
      m.x += this.dir * this.speed * dt;
      if (m.x <= 0) { m.x = 0; this.dir = 1; }
      else if (m.x >= maxRight) { m.x = maxRight; this.dir = -1; }
    }

    if (this.falling) {
      this.falling.vy += 1400 * dt;
      this.falling.y += this.falling.vy * dt;
      this.falling.rot += this.falling.vr * dt;
      if (this.falling.y > this.H + 200) this.falling = null;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.alpha -= dt * 0.7;
      if (p.alpha <= 0 || p.y > this.H + 300) this.particles.splice(i, 1);
    }

    const targetCenterY = this.H * 0.42;
    const movingTopY = this.topY() - BLOCK_H;
    this.camYTarget = Math.min(0, movingTopY - targetCenterY);
    this.camY = lerp(this.camY, this.camYTarget, 1 - Math.pow(0.001, dt));
  };

  Game.prototype.render = function () {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0820");
    bg.addColorStop(0.5, "#0c0a26");
    bg.addColorStop(1, "#06050f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(200,210,255,0.6)";
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const twinkle = 0.5 + 0.5 * Math.sin(this.bgPhase * 10 + s.phase);
      ctx.globalAlpha = s.alpha * twinkle * 0.35;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = s.alpha * twinkle;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.renderGrid(ctx, W, H);

    ctx.save();
    let sx = 0, sy = 0;
    if (this.shake > 0.2) {
      sx = (Math.random() * 2 - 1) * this.shake;
      sy = (Math.random() * 2 - 1) * this.shake;
    }
    ctx.translate(sx, sy);

    var rs = this.remoteState;
    let cam, groundY;
    if (rs) {
      groundY = this.groundY;
      var scaleX = rs.W ? this.W / rs.W : 1;
      var scaleY = rs.H ? this.H / rs.H : 1;
      var bh = BLOCK_H * scaleY;
      const targetCenterY = this.H * 0.42;
      const topBlockY = groundY - rs.blocks.length * bh - bh;
      cam = Math.min(0, topBlockY - targetCenterY);
    } else {
      cam = this.camY;
      groundY = this.groundY;
    }
    ctx.save();
    ctx.translate(0, -cam);

    if (rs) {
      for (let i = 0; i < rs.blocks.length; i++) {
        const b = rs.blocks[i];
        const yTop = groundY - (i + 1) * bh;
        this.drawBlock(ctx, b.x * scaleX, yTop, b.w * scaleX, bh, b.hue, 1);
      }
      if (rs.moving && rs.alive) {
        const yTop = groundY - rs.blocks.length * bh - bh;
        this.drawBlock(ctx, rs.moving.x * scaleX, yTop, rs.moving.w * scaleX, bh, rs.moving.hue, 1);
        this.drawShadow(ctx, rs.moving.x * scaleX, groundY - rs.blocks.length * bh, rs.moving.w * scaleX, rs.moving.hue);
      }
      if (rs.falling) {
        ctx.save();
        ctx.translate(rs.falling.x * scaleX + rs.falling.w * scaleX / 2, rs.falling.y * scaleY + bh / 2);
        ctx.rotate(rs.falling.rot || 0);
        this.drawBlock(ctx, -rs.falling.w * scaleX / 2, -bh / 2, rs.falling.w * scaleX, bh, rs.falling.hue, 1);
        ctx.restore();
      }
    } else {
      for (let i = 0; i < this.blocks.length; i++) {
        const b = this.blocks[i];
        const yTop = this.groundY - (i + 1) * BLOCK_H;
        this.drawBlock(ctx, b.x, yTop, b.w, BLOCK_H, b.hue, 1);
      }

      if (this.moving && this.state === "playing") {
        const yTop = this.topY() - BLOCK_H;
        const bob = Math.sin(this.bgPhase * 6) * 1.2;
        this.drawBlock(ctx, this.moving.x, yTop + bob, this.moving.w, BLOCK_H, this.moving.hue, 1);
        this.drawShadow(ctx, this.moving.x, this.topY(), this.moving.w, this.moving.hue);
      }

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.rot);
        this.drawBlock(ctx, -p.w / 2, -p.h / 2, p.w, p.h, p.hue, Math.max(0, p.alpha));
        ctx.restore();
      }

      if (this.falling) {
        ctx.save();
        ctx.translate(this.falling.x + this.falling.w / 2, this.falling.y + BLOCK_H / 2);
        ctx.rotate(this.falling.rot);
        this.drawBlock(ctx, -this.falling.w / 2, -BLOCK_H / 2, this.falling.w, BLOCK_H, this.falling.hue, 1);
        ctx.restore();
      }
    }

    ctx.restore();

    const groundScreenY = groundY - cam;
    if (groundScreenY < H) {
      const g = ctx.createLinearGradient(0, groundScreenY, 0, H);
      g.addColorStop(0, "rgba(120,180,255,0.18)");
      g.addColorStop(1, "rgba(120,180,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, groundScreenY, W, H - groundScreenY);
      ctx.strokeStyle = "rgba(150,210,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundScreenY);
      ctx.lineTo(W, groundScreenY);
      ctx.stroke();
    }

    if (this.flash > 0.01) {
      ctx.fillStyle = "rgba(255,255,255," + (this.flash * 0.25) + ")";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  };

  Game.prototype.renderGrid = function (ctx, W, H) {
    const spacing = 46;
    const off = (this.bgPhase * spacing * 2) % spacing;
    ctx.strokeStyle = "rgba(90,120,220,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -off; x < W; x += spacing) {
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    const cam = -this.camY * 0.3;
    const yoff = ((cam % spacing) + spacing) % spacing;
    for (let y = -yoff; y < H; y += spacing) {
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
  };

  Game.prototype.drawBlock = function (ctx, x, y, w, h, hue, alpha) {
    if (w <= 0.5) return;
    const fill = "hsla(" + hue + ",90%,58%,0.32)";
    const stroke = "hsla(" + hue + ",95%,70%,0.95)";
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "hsla(" + hue + ",95%,65%,0.9)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = "hsla(" + hue + ",100%,85%,0.5)";
    ctx.fillRect(x + 2, y + 2, w - 4, 3);
    ctx.restore();
  };

  Game.prototype.drawShadow = function (ctx, x, y, w, hue) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "hsla(" + hue + ",95%,60%,0.5)";
    ctx.fillRect(x + 2, y - 2, w, 3);
    ctx.restore();
  };

  Game.prototype.getState = function () {
    var snd = this.mpPendingSounds;
    this.mpPendingSounds = [];
    return {
      W: this.W,
      H: this.H,
      blocks: this.blocks.map(function (b) { return { x: b.x, w: b.w, hue: b.hue }; }),
      moving: this.moving ? { x: this.moving.x, w: this.moving.w, hue: this.moving.hue, dir: this.dir } : null,
      falling: this.falling ? { x: this.falling.x, w: this.falling.w, y: this.falling.y, vy: this.falling.vy, hue: this.falling.hue, rot: this.falling.rot, vr: this.falling.vr } : null,
      score: this.score,
      combo: this.combo,
      speed: this.speed,
      alive: this.state === "playing",
      snd: snd
    };
  };

  Game.prototype.destroy = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("orientationchange", this._onResize);
  };

  NS.Game = Game;
})();
