/**
 * Sound Engine — menggunakan Web Audio API
 * Tidak butuh file audio eksternal, semua dibuat secara programatik.
 */
const SoundEngine = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function resume() {
    const c = getCtx();
    if (c.state === 'suspended') c.resume();
  }

  // Buat oscillator sederhana
  function tone(freq, type, duration, volume = 0.4, delay = 0) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    gain.gain.setValueAtTime(volume, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.05);
  }

  // Suara BENAR (ding manis)
  function correct() {
    resume();
    tone(880, 'sine', 0.15, 0.5);
    tone(1100, 'sine', 0.2, 0.4, 0.12);
    tone(1320, 'sine', 0.3, 0.3, 0.22);
  }

  // Suara SALAH (buzz keras)
  function wrong() {
    resume();
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.5);
    gain.gain.setValueAtTime(0.6, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.65);
  }

  // Suara STRIKE (thud dramatis)
  function strike() {
    resume();
    wrong();
    tone(60, 'sine', 0.4, 0.7, 0.1);
  }

  // Suara TICK timer (klik kecil)
  function tick() {
    resume();
    const c = getCtx();
    const buffer = c.createBuffer(1, c.sampleRate * 0.02, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = 0.15;
    source.connect(gain);
    gain.connect(c.destination);
    source.start(c.currentTime);
  }

  // Suara TIMES UP (alarm)
  function timesUp() {
    resume();
    for (let i = 0; i < 4; i++) {
      tone(880, 'square', 0.15, 0.4, i * 0.25);
      tone(660, 'square', 0.15, 0.3, i * 0.25 + 0.12);
    }
  }

  // Suara MENANG (fanfare naik)
  function celebrate() {
    resume();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => tone(freq, 'sine', 0.4, 0.5, i * 0.15));
    tone(1047, 'sine', 0.8, 0.6, 0.7);
    tone(1319, 'sine', 0.6, 0.4, 0.9);
  }

  // Suara STEAL MODE (suspens)
  function stealMode() {
    resume();
    tone(440, 'sawtooth', 0.3, 0.3);
    tone(466, 'sawtooth', 0.3, 0.3, 0.4);
    tone(440, 'sawtooth', 0.3, 0.3, 0.8);
  }

  // Suara START GAME (drum roll + fanfare pendek)
  function gameStart() {
    resume();
    tone(262, 'sine', 0.2, 0.4);
    tone(330, 'sine', 0.2, 0.4, 0.2);
    tone(392, 'sine', 0.2, 0.4, 0.4);
    tone(523, 'sine', 0.5, 0.5, 0.6);
  }

  // Peringatan timer (ketika sisa <= 10 detik)
  function timerWarning() {
    resume();
    tone(660, 'sine', 0.08, 0.3);
  }

  return { correct, wrong, strike, tick, timesUp, celebrate, stealMode, gameStart, timerWarning, resume };
})();
