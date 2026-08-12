const express = require('express');
const router  = express.Router();
const db      = require('../database');

// GET full state
router.get('/state', (_req, res) => res.json(db.getFullState()));

// POST start round
router.post('/start', (req, res) => {
  const { question_id, active_team_id } = req.body;
  if (!question_id || !active_team_id)
    return res.status(400).json({ error: 'question_id dan active_team_id wajib diisi' });

  const q = db.getQuestion(+question_id);
  if (!q) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  const team = db.getTeam(+active_team_id);
  if (!team) return res.status(404).json({ error: 'Tim tidak ditemukan' });

  db.resetAnswersForQuestion(+question_id);
  db.updateGameState({
    question_id:    +question_id,
    active_team_id: +active_team_id,
    phase:          'playing',
    strikes:        0,
    steal_team_id:  null,
    timer_remaining: q.time_limit,
    timer_running:  true,
    round_points:   0,
  });

  const state = db.getFullState();
  req.io.emit('game:state', state);
  res.json(state);
});

// POST reveal answer
router.post('/reveal/:answerId', (req, res) => {
  const gs = db.getGameState();
  if (gs.phase !== 'playing' && gs.phase !== 'steal')
    return res.status(400).json({ error: 'Game tidak dalam fase aktif' });

  const answer = db.getAnswer(+req.params.answerId);
  if (!answer)        return res.status(404).json({ error: 'Jawaban tidak ditemukan' });
  if (answer.revealed) return res.status(400).json({ error: 'Jawaban sudah terungkap' });

  db.revealAnswer(answer.id);
  db.updateGameState({ round_points: gs.round_points + answer.points });

  const full       = db.getFullState();
  const allRevealed = full.answers.every(a => a.revealed);

  if (allRevealed) {
    const teamId      = gs.phase === 'steal' ? gs.steal_team_id : gs.active_team_id;
    const totalPoints = full.game.round_points;
    db.addScore(teamId, totalPoints);
    db.updateGameState({ phase: 'finished', timer_running: false });
    const finalState = db.getFullState();
    req.io.emit('game:state', finalState);
    req.io.emit('game:celebration', { team_id: teamId, points: totalPoints });
    return res.json(finalState);
  }

  const state = db.getFullState();
  req.io.emit('game:state', state);
  res.json({ success: true });
});

// POST add strike
router.post('/strike', (req, res) => {
  const gs = db.getGameState();
  if (gs.phase !== 'playing' && gs.phase !== 'steal')
    return res.status(400).json({ error: 'Game tidak dalam fase aktif' });

  const maxStrikes = parseInt(db.getSettings().max_strikes) || 3;
  const newStrikes = gs.strikes + 1;

  if (gs.phase === 'steal') {
    db.updateGameState({ strikes: newStrikes, phase: 'finished', timer_running: false });
    const state = db.getFullState();
    req.io.emit('game:state', state);
    req.io.emit('game:steal-fail');
    return res.json(state);
  }

  if (newStrikes >= maxStrikes) {
    const teams     = db.getTeams();
    const otherTeam = teams.find(t => t.id !== gs.active_team_id);
    db.updateGameState({
      strikes:        newStrikes,
      phase:          'steal',
      steal_team_id:  otherTeam ? otherTeam.id : null,
      timer_remaining: 30,
      timer_running:  true,
    });
    const state = db.getFullState();
    req.io.emit('game:state', state);
    req.io.emit('game:steal-mode', { steal_team: otherTeam });
  } else {
    db.updateGameState({ strikes: newStrikes });
    req.io.emit('game:state', db.getFullState());
  }

  res.json(db.getFullState());
});

// POST end round
router.post('/end', (req, res) => {
  const gs = db.getGameState();
  const { award_to_team } = req.body;
  if (award_to_team) db.addScore(+award_to_team, gs.round_points || 0);
  db.updateGameState({ phase: 'finished', timer_running: false });
  const state = db.getFullState();
  req.io.emit('game:state', state);
  res.json(state);
});

// POST pause / resume / reset
router.post('/pause',  (req, res) => {
  db.updateGameState({ timer_running: false });
  req.io.emit('game:state', db.getFullState());
  res.json({ success: true });
});

router.post('/resume', (req, res) => {
  db.updateGameState({ timer_running: true });
  req.io.emit('game:state', db.getFullState());
  res.json({ success: true });
});

router.post('/reset', (req, res) => {
  db.updateGameState({
    question_id: null, active_team_id: null, phase: 'idle',
    strikes: 0, steal_team_id: null, timer_remaining: 60,
    timer_running: false, round_points: 0,
  });
  const state = db.getFullState();
  req.io.emit('game:state', state);
  res.json(state);
});

module.exports = router;
