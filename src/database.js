/**
 * JSON-based Database — tidak butuh library eksternal, murni Node.js
 * Data disimpan di db/data.json
 */
const fs   = require('fs');
const path = require('path');

const DB_DIR  = path.join(__dirname, '..', 'db');
const DB_PATH = path.join(DB_DIR, 'data.json');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

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
      question_id:    null,
      active_team_id: null,
      phase:          'idle',
      strikes:        0,
      steal_team_id:  null,
      timer_remaining: 60,
      timer_running:  false,
      round_points:   0,
    },
    _seq: { question: 1, answer: 1, team: 1 },
  };
}

// ─── DB Class ─────────────────────────────────────────────────────────────────
class DB {
  constructor() {
    this._load();
  }

  _load() {
    try {
      this.data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      // Ensure _seq exists (migration safety)
      if (!this.data._seq) this.data._seq = { question: 1, answer: 1, team: 1 };
    } catch (_) {
      this.data = defaultData();
      this._seed();
      this.save();
    }
  }

  save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
  }

  nextId(type) {
    return this.data._seq[type]++;
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  getQuestions() {
    return this.data.questions;
  }

  getQuestion(id) {
    return this.data.questions.find(q => q.id === id) || null;
  }

  addQuestion({ question, time_limit = 60, category = 'Umum', answers = [] }) {
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
    this.save();
    return q;
  }

  updateQuestion(id, { question, time_limit, category, answers }) {
    const q = this.getQuestion(id);
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
    this.save();
    return q;
  }

  deleteQuestion(id) {
    const idx = this.data.questions.findIndex(q => q.id === id);
    if (idx === -1) return false;
    this.data.questions.splice(idx, 1);
    this.save();
    return true;
  }

  // ── Answers ───────────────────────────────────────────────────────────────
  getAnswer(answerId) {
    for (const q of this.data.questions) {
      const a = q.answers.find(a => a.id === answerId);
      if (a) return a;
    }
    return null;
  }

  revealAnswer(answerId) {
    const a = this.getAnswer(answerId);
    if (!a) return null;
    a.revealed = true;
    this.save();
    return a;
  }

  resetAnswersForQuestion(questionId) {
    const q = this.getQuestion(questionId);
    if (!q) return;
    q.answers.forEach(a => (a.revealed = false));
    this.save();
  }

  // ── Teams ─────────────────────────────────────────────────────────────────
  getTeams() {
    return [...this.data.teams].sort((a, b) => a.pos - b.pos);
  }

  getTeam(id) {
    return this.data.teams.find(t => t.id === id) || null;
  }

  addTeam({ name, color = '#22c55e' }) {
    const id  = this.nextId('team');
    const pos = this.data.teams.length;
    const t   = { id, name, color, score: 0, pos };
    this.data.teams.push(t);
    this.save();
    return t;
  }

  updateTeam(id, { name, color, score }) {
    const t = this.getTeam(id);
    if (!t) return null;
    if (name  !== undefined) t.name  = name;
    if (color !== undefined) t.color = color;
    if (score !== undefined) t.score = +score;
    this.save();
    return t;
  }

  addScore(id, points) {
    const t = this.getTeam(id);
    if (!t) return null;
    t.score += +points;
    this.save();
    return t;
  }

  deleteTeam(id) {
    const idx = this.data.teams.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.data.teams.splice(idx, 1);
    this.save();
    return true;
  }

  resetAllScores() {
    this.data.teams.forEach(t => (t.score = 0));
    this.save();
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings() {
    return { ...this.data.settings };
  }

  updateSettings(obj) {
    Object.assign(this.data.settings, obj);
    this.save();
    return this.getSettings();
  }

  // ── Game State ────────────────────────────────────────────────────────────
  getGameState() {
    return { ...this.data.game_state };
  }

  updateGameState(patch) {
    Object.assign(this.data.game_state, patch);
    this.save();
    return this.getGameState();
  }

  getFullState() {
    const game   = this.getGameState();
    const teams  = this.getTeams();
    const settings = this.getSettings();
    let question = null;
    let answers  = [];

    if (game.question_id) {
      question = this.getQuestion(game.question_id);
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

    seedQuestions.forEach(q => this.addQuestion(q));

    this.addTeam({ name: 'Tim 1', color: '#16a34a' });
    this.addTeam({ name: 'Tim 2', color: '#2563eb' });

    console.log('✅ Sample data berhasil ditambahkan.');
  }
}

module.exports = new DB();
