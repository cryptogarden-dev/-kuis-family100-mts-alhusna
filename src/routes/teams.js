const express = require('express');
const router  = express.Router();
const db      = require('../database');

router.get('/', (_req, res) => res.json(db.getTeams()));

router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama tim tidak boleh kosong' });
  res.status(201).json(db.addTeam({ name: name.trim(), color }));
});

router.put('/:id', (req, res) => {
  const t = db.updateTeam(+req.params.id, req.body);
  if (!t) return res.status(404).json({ error: 'Tim tidak ditemukan' });
  res.json(t);
});

router.post('/:id/add-score', (req, res) => {
  const t = db.addScore(+req.params.id, req.body.points || 0);
  if (!t) return res.status(404).json({ error: 'Tim tidak ditemukan' });
  res.json(t);
});

router.delete('/:id', (req, res) => {
  const ok = db.deleteTeam(+req.params.id);
  if (!ok) return res.status(404).json({ error: 'Tim tidak ditemukan' });
  res.json({ success: true });
});

router.post('/reset-scores', (_req, res) => {
  db.resetAllScores();
  res.json({ success: true });
});

module.exports = router;
