(function () {
  "use strict";
  window.NS = window.NS || {};

  let ctx = null;
  let masterGain = null;
  let muted = false;
  let externalMute = false;
  let started = false;

  function ensure() {
    if (started) {
      if (ctx && ctx.state === "suspended") ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
      started = true;
    } catch (e) {
      ctx = null;
    }
  }

  function effectiveMute() { return muted || externalMute; }

  function tone(freq, dur, type, gain, attack, slideTo) {
    if (!ctx || effectiveMute()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, gain, filterFreq) {
    if (!ctx || effectiveMute()) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filt); filt.connect(g); g.connect(masterGain);
    src.start(t);
  }

  NS.audio = {
    init: ensure,
    setMuted: function (m) { muted = !!m; },
    setExternalMute: function (m) { externalMute = !!m; },
    isMuted: effectiveMute,
    resume: ensure,
    drop: function () {
      tone(180, 0.16, "triangle", 0.32, 0.002, 90);
      noise(0.05, 0.12, 800);
    },
    perfect: function (combo) {
      const base = 520 + Math.min(combo, 12) * 60;
      tone(base, 0.12, "sine", 0.3, 0.002);
      tone(base * 1.5, 0.16, "sine", 0.18, 0.004);
    },
    trim: function () {
      tone(120, 0.1, "sawtooth", 0.12, 0.002, 60);
      noise(0.08, 0.1, 600);
    },
    gameOver: function () {
      tone(300, 0.5, "sawtooth", 0.28, 0.002, 70);
      noise(0.4, 0.12, 500);
    },
    click: function () { tone(440, 0.06, "square", 0.14, 0.002); },
    start: function () {
      tone(330, 0.1, "triangle", 0.22, 0.002);
      tone(495, 0.12, "triangle", 0.2, 0.05);
      tone(660, 0.16, "triangle", 0.18, 0.1);
    }
  };
})();
