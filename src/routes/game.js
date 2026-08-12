const express = require('express');
const router  = express.Router();
const db      = require('../database');
const ah      = require('../asyncHandler');

// GET full state (also polled every ~1s by game.html / admin.html)
router.get('/state', ah(async (_req, res) => res.json(await db.getFullState())));

// POST start round
router.post('/start', ah(async (req, res) => {
  const { question_id, active_team_id } = req.body;
  if (!question_id || !active_team_id)
    return res.status(400).json({ error: 'question_id dan active_team_id wajib diisi' });

  const q = await db.getQuestion(+question_id);
  if (!q) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  const team = await db.getTeam(+active_team_id);
  if (!team) return res.status(404).json({ error: 'Tim tidak ditemukan' });

  await db.resetAnswersForQuestion(+question_id);
  await db.updateGameState({
    question_id:    +question_id,
    active_team_id: +active_team_id,
    phase:          'playing',
    strikes:        0,
    steal_team_id:  null,
    round_points:   0,
  });
  await db.startTimer(q.time_limit);
  await db.pushEvent('round-start', {});

  res.json(await db.getFullState());
}));

// POST reveal answer
router.post('/reveal/:answerId', ah(async (req, res) => {
  const gs = await db.getGameState();
  if (gs.phase !== 'playing' && gs.phase !== 'steal')
    return res.status(400).json({ error: 'Game tidak dalam fase aktif' });

  const answer = await db.getAnswer(+req.params.answerId);
  if (!answer)        return res.status(404).json({ error: 'Jawaban tidak ditemukan' });
  if (answer.revealed) return res.status(400).json({ error: 'Jawaban sudah terungkap' });

  await db.revealAnswer(answer.id);
  await db.updateGameState({ round_points: gs.round_points + answer.points });

  const full        = await db.getFullState();
  const allRevealed  = full.answers.every(a => a.revealed);

  if (allRevealed) {
    const teamId      = gs.phase === 'steal' ? gs.steal_team_id : gs.active_team_id;
    const totalPoints = full.game.round_points;
    await db.addScore(teamId, totalPoints);
    await db.updateGameState({ phase: 'finished' });
    await db.stopTimer();
    await db.pushEvent('celebration', { team_id: teamId, points: totalPoints });
    return res.json(await db.getFullState());
  }

  res.json(await db.getFullState());
}));

// POST add strike
router.post('/strike', ah(async (req, res) => {
  const gs = await db.getGameState();
  if (gs.phase !== 'playing' && gs.phase !== 'steal')
    return res.status(400).json({ error: 'Game tidak dalam fase aktif' });

  const settings    = await db.getSettings();
  const maxStrikes  = parseInt(settings.max_strikes) || 3;
  const newStrikes  = gs.strikes + 1;

  if (gs.phase === 'steal') {
    await db.updateGameState({ strikes: newStrikes, phase: 'finished' });
    await db.stopTimer();
    await db.pushEvent('steal-fail', {});
    return res.json(await db.getFullState());
  }

  if (newStrikes >= maxStrikes) {
    const teams     = await db.getTeams();
    const otherTeam = teams.find(t => t.id !== gs.active_team_id);
    await db.updateGameState({
      strikes:       newStrikes,
      phase:         'steal',
      steal_team_id: otherTeam ? otherTeam.id : null,
    });
    await db.startTimer(30);
    await db.pushEvent('steal-mode', { steal_team: otherTeam });
  } else {
    await db.updateGameState({ strikes: newStrikes });
  }

  res.json(await db.getFullState());
}));

// POST end round
router.post('/end', ah(async (req, res) => {
  const gs = await db.getGameState();
  const { award_to_team } = req.body;
  if (award_to_team) await db.addScore(+award_to_team, gs.round_points || 0);
  await db.updateGameState({ phase: 'finished' });
  await db.stopTimer();
  res.json(await db.getFullState());
}));

// POST pause / resume / reset
router.post('/pause', ah(async (_req, res) => {
  await db.pauseTimer();
  res.json({ success: true });
}));

router.post('/resume', ah(async (_req, res) => {
  await db.resumeTimer();
  res.json({ success: true });
}));

router.post('/reset', ah(async (_req, res) => {
  const settings = await db.getSettings();
  await db.updateGameState({
    question_id: null, active_team_id: null, phase: 'idle',
    strikes: 0, steal_team_id: null,
    timer_remaining: parseInt(settings.default_time) || 60,
    timer_running: false,
    timer_end_at: null,
    round_points: 0,
  });
  res.json(await db.getFullState());
}));

module.exports = router;
