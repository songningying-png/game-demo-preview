const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

const input = { left: false, right: false, jump: false };
let prevJumpInput = false;
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyA") input.left = true;
  if (e.code === "KeyD") input.right = true;
  if (e.code === "Space") input.jump = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "KeyA") input.left = false;
  if (e.code === "KeyD") input.right = false;
  if (e.code === "Space") input.jump = false;
});

function noise(x, a, b) {
  return Math.sin(x * a) * b + Math.sin(x * a * 0.37) * b * 0.6;
}

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.ambBus = null;
    this.enabled = false;
    this.musicOsc = null;
    this.musicGain = null;
    this.ambientNoise = null;
    this.ambientFilter = null;
    this.ambientGain = null;
    this.level = 1;
    this.unlocked = false;
  }

  init() {
    if (this.enabled) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.ambBus = this.ctx.createGain();

    this.master.gain.value = 0.85;
    this.musicBus.gain.value = 0.42;
    this.sfxBus.gain.value = 0.62;
    this.ambBus.gain.value = 0.24;

    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambBus.connect(this.master);
    this.master.connect(this.ctx.destination);

    this.startAmbient();
    this.startMusicForLevel(1);
    this.enabled = true;
  }

  ensureReady() {
    if (!this.enabled) this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    if (this.enabled && !this.unlocked) {
      this.unlocked = true;
      // Audible confirmation that audio has been unlocked.
      this.shortTone(520, 0.18, "sine", 0.18);
      this.shortTone(780, 0.22, "triangle", 0.14);
    }
  }

  startAmbient() {
    if (!this.ctx || this.ambientNoise) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.8;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambBus);
    src.start();

    this.ambientNoise = src;
    this.ambientFilter = filter;
    this.ambientGain = gain;
    this.rampGain(gain, 0.16, 2.2);
  }

  startMusicForLevel(level) {
    if (!this.ctx) return;
    this.level = level;
    if (this.musicOsc) {
      this.musicOsc.stop(this.ctx.currentTime + 0.06);
      this.musicOsc.disconnect();
      this.musicOsc = null;
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = level === 1 ? 530 : 460;
    gain.gain.value = 0.0001;

    osc.type = level === 1 ? "triangle" : "sawtooth";
    osc.frequency.value = level === 1 ? 98 : 82;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start();

    this.musicOsc = osc;
    this.musicGain = gain;
    this.rampGain(gain, level === 1 ? 0.1 : 0.13, 1.6);
  }

  rampGain(node, target, seconds) {
    if (!this.ctx || !node) return;
    const t = this.ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setTargetAtTime(target, t, Math.max(0.02, seconds * 0.25));
  }

  shortTone(freq, duration, type, volume) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  playJump() {
    this.shortTone(390, 0.18, "square", 0.09);
    this.shortTone(520, 0.11, "triangle", 0.05);
  }

  playOrbActivate() {
    this.shortTone(440, 0.26, "sine", 0.12);
    this.shortTone(660, 0.34, "triangle", 0.08);
  }

  playPathReveal() {
    this.shortTone(740, 0.1, "sine", 0.07);
  }

  playFinalLanding() {
    this.shortTone(160, 0.22, "sawtooth", 0.11);
    this.shortTone(240, 0.24, "triangle", 0.08);
  }

  playEndingStinger() {
    this.shortTone(262, 0.38, "triangle", 0.1);
    this.shortTone(330, 0.44, "triangle", 0.08);
    this.shortTone(392, 0.52, "sine", 0.07);
  }
}

const audio = new AudioSystem();
window.addEventListener("pointerdown", () => audio.ensureReady());
window.addEventListener("keydown", () => audio.ensureReady());

const world = {
  level: 1,
  levelSwitchPending: false,
  width1: 9000,
  width2: 9000,
  orbX: 4200,
  orbY: 0,
  endX: 7800,
  statueX: 7140,
  scriptedClimbStarted: false,
  endingShown: false
};

const player = {
  x: 120,
  y: 0,
  vx: 0,
  vy: 0,
  w: 34,
  h: 54,
  onGround: false,
  controlLocked: false
};

const statueRoute = [
  { label: "ground_start", dx: -440, dy: 0 }, // fixed to platform in getStatuePoints()
  { label: "leg_outer", dx: -230, dy: -95 }, // longer gap from point 1 -> 2
  { label: "waist", dx: -90, dy: -170 },
  { label: "left_hand", dx: -250, dy: -245 },
  { label: "left_shoulder", dx: -120, dy: -325 },
  { label: "head_top", dx: 20, dy: -418 },
  { label: "sword_tail", dx: 190, dy: -336 },
  { label: "sword_mid", dx: 120, dy: -242 },
  { label: "sword_tip", dx: 275, dy: -146 },
  { label: "ground_end", dx: 360, dy: -22 } // final jump to ground
];

const scriptedMove = {
  active: false,
  points: [],
  index: 0,
  speed: 4.4,
  finalJumpVelX: 5.8,
  finalJumpVelY: -10.8
};

const guideFX = {
  active: false,
  points: [],
  revealedCount: 0,
  revealTick: 0,
  revealInterval: 28,
  holdAfterReveal: 54,
  holdTick: 0,
  streamTick: 0,
  streamParticles: []
};

function getStatuePoints() {
  const baseY = getGroundY(world.statueX);
  const points = statueRoute.map((p) => ({
    x: world.statueX + p.dx,
    y: baseY + p.dy,
    label: p.label
  }));
  // First point snaps onto the right platform top.
  const first = points[0];
  first.y = terrainHeightAt(first.x) - 12;
  return points;
}

function startGuideActivation() {
  guideFX.active = true;
  guideFX.points = getStatuePoints();
  guideFX.revealedCount = 0;
  guideFX.revealTick = 0;
  guideFX.holdTick = 0;
  guideFX.streamTick = 0;
  guideFX.streamParticles.length = 0;
  player.controlLocked = true;
  player.vx = 0;
  player.vy = 0;
}

function startStatueClimbSequence() {
  scriptedMove.active = true;
  scriptedMove.points = guideFX.points.length > 0 ? guideFX.points : getStatuePoints();
  scriptedMove.index = 0;
  player.controlLocked = true;
  player.vx = 0;
  player.vy = 0;
}

const camera = { x: 0, y: 0, zoom: 1 };

const particles = [];
function emitOrbBurst(x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 6;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 70 + Math.random() * 40
    });
  }
}

function getGroundY(x) {
  if (world.level === 1) {
    return canvas.height * 0.83 + noise(x * 0.01, 0.8, 18);
  }
  return canvas.height * 0.86 + noise(x * 0.01, 0.7, 20);
}

function getObstacles() {
  if (world.level === 1) {
    return [
      { x: 900, w: 160, h: 90 },
      { x: 1500, w: 140, h: 120 },
      { x: 2500, w: 420, h: 150 },
      { x: 3400, w: 360, h: 120 },
      { x: 4700, w: 700, h: 220 }
    ];
  }
  return [
    { x: 1000, w: 900, h: 120 },
    { x: 2400, w: 700, h: 120 },
    { x: 3600, w: 120, h: 100 },
    { x: 4100, w: 120, h: 170 },
    { x: 4600, w: 120, h: 230 },
    { x: 5100, w: 120, h: 300 },
    { x: 5600, w: 120, h: 360 },
    { x: 6200, w: 550, h: 80 }
  ];
}

function terrainHeightAt(x) {
  let y = getGroundY(x);
  const obs = getObstacles();
  for (const o of obs) {
    if (x > o.x && x < o.x + o.w) {
      y = Math.min(y, getGroundY(o.x) - o.h);
    }
  }
  return y;
}

function update() {
  const speed = 2.9;
  if (!player.controlLocked) {
    if (input.left) player.vx = -speed;
    else if (input.right) player.vx = speed;
    else player.vx *= 0.8;

    if (input.jump && player.onGround) {
      player.vy = -10.5;
      player.onGround = false;
    }
  }

  if (guideFX.active) {
    guideFX.revealTick += 1;
    guideFX.streamTick += 1;

    if (guideFX.revealedCount < guideFX.points.length && guideFX.revealTick >= guideFX.revealInterval) {
      guideFX.revealTick = 0;
      guideFX.revealedCount += 1;
      audio.playPathReveal();
      const p = guideFX.points[guideFX.revealedCount - 1];
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 0.7 + Math.random() * 2.2;
        guideFX.streamParticles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 44 + Math.random() * 26,
          size: 2 + Math.random() * 2.2
        });
      }
    }

    if (guideFX.streamTick >= 5 && guideFX.revealedCount > 0) {
      guideFX.streamTick = 0;
      const targetIdx = Math.max(0, guideFX.revealedCount - 1);
      const t = guideFX.points[targetIdx];
      guideFX.streamParticles.push({
        x: player.x,
        y: player.y - 12,
        vx: (t.x - player.x) * 0.03,
        vy: (t.y - (player.y - 12)) * 0.03,
        life: 42 + Math.random() * 18,
        size: 2.8 + Math.random() * 1.6
      });
    }

    if (guideFX.revealedCount >= guideFX.points.length) {
      guideFX.holdTick += 1;
      if (guideFX.holdTick >= guideFX.holdAfterReveal) {
        guideFX.active = false;
        startStatueClimbSequence();
      }
    }
  } else if (scriptedMove.active) {
    const target = scriptedMove.points[scriptedMove.index];
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(scriptedMove.speed, dist);
    if (dist > 0.001) {
      player.x += (dx / dist) * step;
      player.y += (dy / dist) * step;
    }
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;

    if (dist < 8) {
      scriptedMove.index += 1;
      if (scriptedMove.index >= scriptedMove.points.length - 1) {
        // Last leg uses a visible jump arc back to ground.
        scriptedMove.active = false;
        player.controlLocked = false;
        player.vx = scriptedMove.finalJumpVelX;
        player.vy = scriptedMove.finalJumpVelY;
      }
    }
  } else {
    player.vy += 0.45;
    player.x += player.vx;
    player.y += player.vy;

    const footY = player.y + player.h * 0.5;
    const floor = terrainHeightAt(player.x);
    if (footY > floor) {
      const landedFromAir = player.vy > 3.2;
      player.y = floor - player.h * 0.5;
      player.vy = 0;
      player.onGround = true;
      if (landedFromAir && world.scriptedClimbStarted) {
        audio.playFinalLanding();
      }
    }
  }

  const targetCamX = player.x - canvas.width * 0.35;
  camera.x += (targetCamX - camera.x) * 0.09;

  if (world.level === 1) {
    const dx = player.x - world.orbX;
    const dy = player.y - (getGroundY(world.orbX) - 140);
    if (!world.levelSwitchPending && Math.hypot(dx, dy) < 48) {
      world.levelSwitchPending = true;
      emitOrbBurst(world.orbX, getGroundY(world.orbX) - 140, 30000);
      audio.playOrbActivate();
      document.getElementById("hint").textContent = "点击鼠标进入第二关";
    }
  } else {
    if (!world.scriptedClimbStarted && player.x > world.endX - 580) {
      world.scriptedClimbStarted = true;
      document.getElementById("hint").textContent = "攀上巨剑雕像...";
      startGuideActivation();
    }
    if (world.scriptedClimbStarted && !scriptedMove.active && !world.endingShown && player.onGround && player.x > world.endX) {
      world.endingShown = true;
      audio.playEndingStinger();
      document.getElementById("hint").textContent = "一切，才刚刚开始。";
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.03;
    p.life -= 1;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = guideFX.streamParticles.length - 1; i >= 0; i--) {
    const p = guideFX.streamParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.01;
    p.vx *= 0.985;
    p.life -= 1;
    if (p.life <= 0) guideFX.streamParticles.splice(i, 1);
  }
}

window.addEventListener("mousedown", () => {
  if (world.levelSwitchPending && world.level === 1) {
    world.level = 2;
    audio.startMusicForLevel(2);
    world.levelSwitchPending = false;
    world.scriptedClimbStarted = false;
    world.endingShown = false;
    player.controlLocked = false;
    scriptedMove.active = false;
    guideFX.active = false;
    guideFX.streamParticles.length = 0;
    player.x = 260;
    player.y = getGroundY(player.x) - 100;
    document.getElementById("hint").textContent = "第二关：巨型雕像与悬浮";
  }
});

function drawMountains(layer, color, amp, freq, offsetY) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let sx = 0; sx <= canvas.width; sx += 8) {
    const wx = (sx + camera.x * layer) * 0.01;
    const y = offsetY + Math.sin(wx * freq) * amp + Math.sin(wx * freq * 0.44) * amp * 0.6;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
}

function drawGroundAndStones() {
  const start = Math.floor(camera.x) - 120;
  const end = start + canvas.width + 240;

  ctx.fillStyle = world.level === 1 ? "#f5f1ef" : "#f3d9d4";
  ctx.beginPath();
  ctx.moveTo(-50, canvas.height + 50);
  for (let x = start; x <= end; x += 6) {
    const sx = x - camera.x;
    ctx.lineTo(sx, getGroundY(x));
  }
  ctx.lineTo(canvas.width + 50, canvas.height + 50);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#1f2530";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = start; x <= end; x += 6) {
    const sx = x - camera.x;
    const y = getGroundY(x);
    if (x === start) ctx.moveTo(sx, y);
    else ctx.lineTo(sx, y);
  }
  ctx.stroke();

  for (let i = 0; i < 120; i++) {
    const rx = start + i * 95 + (Math.sin(i * 17.1) * 42);
    const ry = getGroundY(rx) - 5;
    drawRock(rx - camera.x, ry, 30 + (i % 3) * 20, 16 + (i % 4) * 10);
  }
}

function drawRock(x, y, w, h) {
  ctx.save();
  ctx.translate(x, y);
  const tilt = Math.sin(x * 0.013) * 0.3;
  ctx.rotate(tilt);

  ctx.fillStyle = "#121a26";
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, 0);
  ctx.lineTo(-w * 0.26, -h * 0.95);
  ctx.lineTo(w * 0.12, -h * 0.82);
  ctx.lineTo(w * 0.48, -h * 0.2);
  ctx.lineTo(w * 0.35, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2f3743";
  ctx.beginPath();
  ctx.moveTo(-w * 0.25, -h * 0.65);
  ctx.lineTo(w * 0.06, -h * 0.76);
  ctx.lineTo(w * 0.35, -h * 0.25);
  ctx.lineTo(-w * 0.05, -h * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObstacles() {
  const obs = getObstacles();
  ctx.fillStyle = world.level === 1 ? "#15202d" : "#3d2025";
  for (const o of obs) {
    const x = o.x - camera.x;
    const y = getGroundY(o.x) - o.h;
    ctx.fillRect(x, y, o.w, o.h);
  }
}

function drawGiantSwordStatue() {
  if (world.level !== 2) return;

  const baseGroundY = getGroundY(world.statueX);
  const baseX = world.statueX - camera.x;
  const baseY = baseGroundY;

  ctx.save();

  // Base aligned to ground.
  ctx.fillStyle = "#2a1618";
  ctx.fillRect(baseX - 120, baseY - 42, 240, 42);

  // Torso and head.
  ctx.fillStyle = "#3a1f23";
  ctx.fillRect(baseX - 38, baseY - 270, 76, 190);
  ctx.fillRect(baseX - 28, baseY - 330, 56, 56);

  // Shoulders and arms.
  ctx.fillRect(baseX - 120, baseY - 260, 240, 24);
  ctx.fillRect(baseX - 132, baseY - 236, 38, 116);
  ctx.fillRect(baseX + 94, baseY - 236, 38, 116);

  // Legs.
  ctx.fillRect(baseX - 70, baseY - 120, 40, 82);
  ctx.fillRect(baseX + 30, baseY - 120, 40, 82);

  // Giant sword.
  ctx.save();
  ctx.translate(baseX + 112, baseY - 242);
  ctx.rotate(-0.75);
  ctx.fillStyle = "#dbc7c3";
  ctx.fillRect(-18, -12, 220, 24);
  ctx.fillStyle = "#a67f77";
  ctx.fillRect(-48, -8, 30, 16);
  ctx.restore();

  ctx.restore();
}

function drawFog() {
  for (let i = 0; i < 2; i++) {
    const alpha = i === 0 ? 0.08 : 0.14;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (let n = 0; n < 12; n++) {
      const x = ((n * 220 + performance.now() * (i === 0 ? 0.02 : 0.05)) % (canvas.width + 320)) - 160;
      const y = canvas.height * (i === 0 ? 0.34 : 0.55) + Math.sin(n + performance.now() * 0.001) * 20;
      ctx.beginPath();
      ctx.ellipse(x, y, 130, i === 0 ? 34 : 52, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayer() {
  const x = player.x - camera.x;
  const y = player.y;
  ctx.fillStyle = "#111";
  ctx.fillRect(x - player.w * 0.5, y - player.h * 0.5, player.w, player.h);
}

function drawOrbAndParticles() {
  if (world.level === 1 && !world.levelSwitchPending) {
    const x = world.orbX - camera.x;
    const y = getGroundY(world.orbX) - 140;
    const pulse = 14 + Math.sin(performance.now() * 0.01) * 3;
    const g = ctx.createRadialGradient(x, y, 2, x, y, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const p of particles) {
    ctx.fillRect(p.x - camera.x, p.y, 2, 2);
  }

  if (world.level === 2 && (guideFX.active || world.scriptedClimbStarted)) {
    const now = performance.now();
    for (let i = 0; i < guideFX.revealedCount; i++) {
      const wp = guideFX.points[i];
      const sx = wp.x - camera.x;
      const sy = wp.y;
      const pulse = 7 + Math.sin(now * 0.006 + i * 0.8) * 2.4;
      const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 26);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.45, "rgba(255,235,210,0.8)");
      glow.addColorStop(1, "rgba(255,220,200,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,250,245,0.98)";
      ctx.beginPath();
      ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of guideFX.streamParticles) {
      const a = Math.min(1, p.life / 30);
      ctx.fillStyle = `rgba(255,245,235,${a})`;
      ctx.beginPath();
      ctx.arc(p.x - camera.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function render() {
  const top = world.level === 1 ? "#f6f3f2" : "#f2d7d2";
  const bottom = world.level === 1 ? "#e4b9b5" : "#d77774";
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, top);
  bg.addColorStop(1, bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawMountains(0.08, "rgba(116,73,78,0.22)", 26, 0.5, canvas.height * 0.34);
  drawMountains(0.15, "rgba(100,61,67,0.26)", 32, 0.7, canvas.height * 0.42);
  drawMountains(0.22, "rgba(84,48,54,0.32)", 38, 0.9, canvas.height * 0.5);
  drawMountains(0.3, "rgba(74,37,43,0.36)", 42, 1.1, canvas.height * 0.58);
  drawMountains(0.4, "rgba(60,28,34,0.42)", 48, 1.4, canvas.height * 0.66);

  drawFog();
  drawGroundAndStones();
  drawObstacles();
  drawGiantSwordStatue();
  drawOrbAndParticles();
  drawPlayer();
}

function loop() {
  if (!player.controlLocked && input.jump && !prevJumpInput && player.onGround) {
    audio.playJump();
  }
  prevJumpInput = input.jump;
  update();
  render();
  requestAnimationFrame(loop);
}
loop();
