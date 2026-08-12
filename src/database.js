/**
 * Database layer with two backends:
 *  - File-based JSON (db/data.json) — used for local dev / self-hosting.
 *  - Upstash Redis (REST API) — used on serverless platforms like Vercel,
 *    where the filesystem is read-only/ephemeral.
 *
 * Backend is auto-selected: if UPSTASH_REDIS_REST_URL (or Vercel's
 * KV_REST_API_URL) env vars are present, Redis is used. Otherwise falls
 * back to the local JSON file.
 *
 * The whole app state is stored as a single JSON blob under one key,
 * mirroring the previous file-based structure as closely as possible.
 */
const fs   = require('fs');
const path = require('path');

const DB_DIR  = path.join(__dirname, '..', 'db');
const DB_PATH = path.join(DB_DIR, 'data.json');
const REDIS_KEY = 'kuis_family100:data';

// Strip accidental wrapping quotes (common when copy-pasting env var values
// into a dashboard, e.g. UPSTASH_REDIS_REST_URL="https://..." instead of
// UPSTASH_REDIS_REST_URL=https://...) — a quoted value would otherwise be
// an invalid URL/token and cause requests to hang instead of failing fast.
function cleanEnv(v) {
  if (!v) return v;
  return v.trim().replace(/^['"]/, '').replace(/['"]$/, '');
}

const KV_URL      = cleanEnv(process.env.KV_REST_API_URL);
const KV_TOKEN    = cleanEnv(process.env.KV_REST_API_TOKEN);
const UPSTASH_URL   = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
const UPSTASH_TOKEN = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);

const HAS_VERCEL_KV = !!(KV_URL && KV_TOKEN);
const HAS_UPSTASH   = !!(UPSTASH_URL && UPSTASH_TOKEN);
const USE_REDIS = HAS_VERCEL_KV || HAS_UPSTASH;

let redisClient = null;
if (USE_REDIS) {
  const { Redis } = require('@upstash/redis');
  redisClient = HAS_VERCEL_KV
    ? new Redis({ url: KV_URL, token: KV_TOKEN })
    : new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
}

// Redis calls should never hang forever — if Upstash is unreachable or the
// credentials are wrong, fail fast with a clear error instead of leaving
// the HTTP request open until the platform's own timeout.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Redis timeout after ${ms}ms (${label}) — cek UPSTASH_REDIS_REST_URL/TOKEN`)), ms)
    ),
  ]);
}

// ─── Default Structure ────────────────────────────────────────────────────────
function defaultData() {
  return {
    questions: [],
    teams: [],
    settings: {
      max_strikes:  '3',
      default_time: '60',
      school_name:  'MTS Al Husna',
      app_title:    'KUIS FAMILY 100',
    },
    game_state: {
      question_id:     null,
      active_team_id:  null,
      phase:           'idle', // idle | playing | steal | timesup | finished
      strikes:         0,
      steal_team_id:   null,
      timer_remaining: 60,
      timer_running:   false,
      timer_end_at:    null, // epoch ms — set while timer_running is true
      round_points:    0,
      last_event:      null, // { id, type, payload, at } — for client-side one-shot effects
    },
    _seq: { question: 1, answer: 1, team: 1 },
  };
}

// ─── DB Class ─────────────────────────────────────────────────────────────────
class DB {
  constructor() {
    this.data  = null;
    this.ready = this._load();
  }

  async _load() {
    let loaded = null;
    try {
      if (USE_REDIS) {
        const raw = await withTimeout(redisClient.get(REDIS_KEY), 8000, 'get');
        if (raw) loaded = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } else {
        loaded = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      }
    } catch (err) {
      if (USE_REDIS) {
        // Surface the real reason instead of silently seeding empty data,
        // which would mask a bad UPSTASH_REDIS_REST_URL/TOKEN.
        console.error('❌ Gagal terhubung ke Redis:', err.message);
        throw err;
      }
      loaded = null;
    }

    if (loaded) {
      this.data = loaded;
      if (!this.data._seq) this.data._seq = { question: 1, answer: 1, team: 1 };
      if (!this.data.game_state) this.data.game_state = defaultData().game_state;
      if (this.data.game_state.timer_end_at === undefined) this.data.game_state.timer_end_at = null;
      if (this.data.game_state.last_event === undefined) this.data.game_state.last_event = null;
    } else {
      this.data = defaultData();
      this._seed();
      await this.save();
    }
  }

  async save() {
    if (USE_REDIS) {
      await withTimeout(redisClient.set(REDIS_KEY, JSON.stringify(this.data)), 8000, 'set');
    } else {
      if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    }
  }

  nextId(type) {
    return this.data._seq[type]++;
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  async getQuestions() {
    await this.ready;
    return this.data.questions;
  }

  async getQuestion(id) {
    await this.ready;
    return this.data.questions.find(q => q.id === id) || null;
  }

  async addQuestion({ question, time_limit = 60, category = 'Umum', answers = [] }) {
    await this.ready;
    const id = this.nextId('question');
    const q = {
      id,
      question,
      time_limit: +time_limit,
      category,
      created_at: new Date().toISOString(),
      answers: answers.map((a, i) => ({
        id:          this.nextId('answer'),
        question_id: id,
        answer:      a.answer,
        points:      +a.points || 10,
        rank:        i + 1,
        revealed:    false,
      })),
    };
    this.data.questions.unshift(q);
    await this.save();
    return q;
  }

  async updateQuestion(id, { question, time_limit, category, answers }) {
    await this.ready;
    const q = await this.getQuestion(id);
    if (!q) return null;
    if (question   !== undefined) q.question   = question;
    if (time_limit !== undefined) q.time_limit = +time_limit;
    if (category   !== undefined) q.category   = category;
    if (answers && answers.length > 0) {
      q.answers = answers.map((a, i) => ({
        id:          this.nextId('answer'),
        question_id: id,
        answer:      a.answer,
        points:      +a.points || 10,
        rank:        i + 1,
        revealed:    false,
      }));
    }
    await this.save();
    return q;
  }

  async deleteQuestion(id) {
    await this.ready;
    const idx = this.data.questions.findIndex(q => q.id === id);
    if (idx === -1) return false;
    this.data.questions.splice(idx, 1);
    await this.save();
    return true;
  }

  // ── Answers ───────────────────────────────────────────────────────────────
  async getAnswer(answerId) {
    await this.ready;
    for (const q of this.data.questions) {
      const a = q.answers.find(a => a.id === answerId);
      if (a) return a;
    }
    return null;
  }

  async revealAnswer(answerId) {
    await this.ready;
    const a = await this.getAnswer(answerId);
    if (!a) return null;
    a.revealed = true;
    await this.save();
    return a;
  }

  async resetAnswersForQuestion(questionId) {
    await this.ready;
    const q = await this.getQuestion(questionId);
    if (!q) return;
    q.answers.forEach(a => (a.revealed = false));
    await this.save();
  }

  // ── Teams ─────────────────────────────────────────────────────────────────
  async getTeams() {
    await this.ready;
    return [...this.data.teams].sort((a, b) => a.pos - b.pos);
  }

  async getTeam(id) {
    await this.ready;
    return this.data.teams.find(t => t.id === id) || null;
  }

  async addTeam({ name, color = '#22c55e' }) {
    await this.ready;
    const id  = this.nextId('team');
    const pos = this.data.teams.length;
    const t   = { id, name, color, score: 0, pos };
    this.data.teams.push(t);
    await this.save();
    return t;
  }

  async updateTeam(id, { name, color, score }) {
    await this.ready;
    const t = await this.getTeam(id);
    if (!t) return null;
    if (name  !== undefined) t.name  = name;
    if (color !== undefined) t.color = color;
    if (score !== undefined) t.score = +score;
    await this.save();
    return t;
  }

  async addScore(id, points) {
    await this.ready;
    const t = await this.getTeam(id);
    if (!t) return null;
    t.score += +points;
    await this.save();
    return t;
  }

  async deleteTeam(id) {
    await this.ready;
    const idx = this.data.teams.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.data.teams.splice(idx, 1);
    await this.save();
    return true;
  }

  async resetAllScores() {
    await this.ready;
    this.data.teams.forEach(t => (t.score = 0));
    await this.save();
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  async getSettings() {
    await this.ready;
    return { ...this.data.settings };
  }

  async updateSettings(obj) {
    await this.ready;
    Object.assign(this.data.settings, obj);
    await this.save();
    return this.getSettings();
  }

  // ── Game State & Timer ───────────────────────────────────────────────────
  // The timer is timestamp-based (not a running interval) so it survives
  // serverless cold starts / restarts. `timer_end_at` is the epoch ms when
  // the timer will hit zero; remaining seconds are computed on read.
  _liveRemaining() {
    const gs = this.data.game_state;
    if (gs.timer_running && gs.timer_end_at) {
      return Math.max(0, Math.ceil((gs.timer_end_at - Date.now()) / 1000));
    }
    return gs.timer_remaining;
  }

  _checkExpiry() {
    const gs = this.data.game_state;
    if (gs.timer_running && gs.timer_end_at && Date.now() >= gs.timer_end_at) {
      gs.timer_running   = false;
      gs.timer_remaining = 0;
      gs.timer_end_at    = null;
      if (gs.phase === 'playing' || gs.phase === 'steal') {
        gs.phase = 'timesup';
        this._pushEvent('timesup', {});
      }
      return true;
    }
    return false;
  }

  _pushEvent(type, payload) {
    const gs = this.data.game_state;
    const prevId = gs.last_event?.id || 0;
    gs.last_event = { id: prevId + 1, type, payload, at: Date.now() };
  }

  async pushEvent(type, payload) {
    await this.ready;
    this._pushEvent(type, payload);
    await this.save();
  }

  async startTimer(seconds) {
    await this.ready;
    const gs = this.data.game_state;
    gs.timer_running   = true;
    gs.timer_remaining = +seconds;
    gs.timer_end_at    = Date.now() + (+seconds) * 1000;
    await this.save();
  }

  async stopTimer() {
    await this.ready;
    const gs = this.data.game_state;
    gs.timer_remaining = this._liveRemaining();
    gs.timer_running   = false;
    gs.timer_end_at     = null;
    await this.save();
  }

  async pauseTimer() {
    await this.stopTimer();
  }

  async resumeTimer() {
    await this.ready;
    const gs = this.data.game_state;
    if (gs.timer_remaining > 0) {
      gs.timer_running = true;
      gs.timer_end_at  = Date.now() + gs.timer_remaining * 1000;
      await this.save();
    }
  }

  async getGameState() {
    await this.ready;
    const expired = this._checkExpiry();
    if (expired) await this.save();
    return { ...this.data.game_state, timer_remaining: this._liveRemaining() };
  }

  async updateGameState(patch) {
    await this.ready;
    Object.assign(this.data.game_state, patch);
    await this.save();
    return this.getGameState();
  }

  async getFullState() {
    await this.ready;
    const game     = await this.getGameState();
    const teams    = await this.getTeams();
    const settings = await this.getSettings();
    let question = null;
    let answers  = [];

    if (game.question_id) {
      question = await this.getQuestion(game.question_id);
      answers  = question ? [...question.answers] : [];
    }

    return { game, teams, question, answers, settings };
  }

  // ── Seed Data ─────────────────────────────────────────────────────────────
  _seed() {
    const seedQuestions = [
      {
        question: 'Sebutkan Rukun Islam!',
        category: 'Agama Islam', time_limit: 60,
        answers: [
          { answer: 'Syahadat', points: 40 }, { answer: 'Sholat', points: 30 },
          { answer: 'Zakat', points: 15 },    { answer: 'Puasa', points: 10 },
          { answer: 'Haji', points: 5 },
        ],
      },
      {
        question: 'Sebutkan Nama-Nama Nabi Ulul Azmi!',
        category: 'Agama Islam', time_limit: 60,
        answers: [
          { answer: 'Nabi Muhammad SAW', points: 35 }, { answer: 'Nabi Ibrahim AS', points: 25 },
          { answer: 'Nabi Musa AS', points: 20 },      { answer: 'Nabi Isa AS', points: 12 },
          { answer: 'Nabi Nuh AS', points: 8 },
        ],
      },
      {
        question: 'Sebutkan Planet-Planet di Tata Surya!',
        category: 'IPA', time_limit: 60,
        answers: [
          { answer: 'Bumi', points: 30 },    { answer: 'Mars', points: 25 },
          { answer: 'Jupiter', points: 20 }, { answer: 'Saturnus', points: 15 },
          { answer: 'Venus', points: 10 },
        ],
      },
      {
        question: 'Sebutkan Pelajaran yang Ada di MTS!',
        category: 'Pengetahuan Umum', time_limit: 60,
        answers: [
          { answer: 'Matematika', points: 30 },      { answer: 'Bahasa Indonesia', points: 25 },
          { answer: 'IPA', points: 20 },             { answer: 'Bahasa Arab', points: 15 },
          { answer: 'Fiqih', points: 10 },
        ],
      },
      {
        question: 'Sebutkan Perangkat Keras Komputer!',
        category: 'TIK', time_limit: 60,
        answers: [
          { answer: 'Monitor', points: 30 },  { answer: 'Keyboard', points: 25 },
          { answer: 'Mouse', points: 20 },    { answer: 'CPU', points: 15 },
          { answer: 'Printer', points: 10 },
        ],
      },
      {
        question: 'Sebutkan Bahasa Pemrograman yang Populer!',
        category: 'TIK / Coding', time_limit: 60,
        answers: [
          { answer: 'Python', points: 35 },     { answer: 'JavaScript', points: 25 },
          { answer: 'Java', points: 18 },       { answer: 'PHP', points: 12 },
          { answer: 'C++', points: 10 },
        ],
      },
      {
        question: 'Sebutkan Nama Bulan Hijriyah yang Terkenal!',
        category: 'Agama Islam', time_limit: 60,
        answers: [
          { answer: 'Ramadan', points: 35 },   { answer: 'Muharram', points: 25 },
          { answer: 'Syawal', points: 18 },    { answer: 'Dzulhijjah', points: 12 },
          { answer: 'Rajab', points: 10 },
        ],
      },
      {
        question: 'Sebutkan Aplikasi Belajar Online Populer!',
        category: 'TIK', time_limit: 60,
        answers: [
          { answer: 'Google Classroom', points: 32 }, { answer: 'YouTube', points: 28 },
          { answer: 'Quizizz', points: 18 },          { answer: 'Ruangguru', points: 12 },
          { answer: 'Khan Academy', points: 10 },
        ],
      },
    ];

    // Seed is done synchronously in-memory here (before first save()).
    let qSeq = this.data._seq.question;
    let aSeq = this.data._seq.answer;
    seedQuestions.forEach(sq => {
      const id = qSeq++;
      this.data.questions.unshift({
        id,
        question: sq.question,
        time_limit: sq.time_limit,
        category: sq.category,
        created_at: new Date().toISOString(),
        answers: sq.answers.map((a, i) => ({
          id: aSeq++, question_id: id, answer: a.answer,
          points: a.points, rank: i + 1, revealed: false,
        })),
      });
    });
    this.data._seq.question = qSeq;
    this.data._seq.answer   = aSeq;

    let tSeq = this.data._seq.team;
    this.data.teams.push({ id: tSeq++, name: 'Tim 1', color: '#16a34a', score: 0, pos: 0 });
    this.data.teams.push({ id: tSeq++, name: 'Tim 2', color: '#2563eb', score: 0, pos: 1 });
    this.data._seq.team = tSeq;

    console.log('✅ Sample data berhasil ditambahkan.');
  }
}

module.exports = new DB();
