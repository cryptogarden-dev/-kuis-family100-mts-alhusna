const express = require('express');
const router  = express.Router();
const db      = require('../database');

router.get('/', async (_req, res) => res.json(await db.getTeams()));

router.post('/', async (req, res) => {
  const { name, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama tim tidak boleh kosong' });
  res.status(201).json(await db.addTeam({ name: name.trim(), color }));
});

router.put('/:id', async (req, res) => {
  const t = await db.updateTeam(+req.params.id, req.body);
  if (!t) return res.status(404).json({ error: 'Tim tidak ditemukan' });
  res.json(t);
});

router.post('/:id/add-score', async (req, res) => {
  const t = await db.addScore(+req.params.id, req.body.points || 0);
  if (!t) return res.status(404).json({ error: 'Tim tidak ditemukan' });
  res.json(t);
});

router.delete('/:id', async (req, res) => {
  const ok = await db.deleteTeam(+req.params.id);
  if (!ok) return res.status(404).json({ error: 'Tim tidak ditemukan' });
  res.json({ success: true });
});

router.post('/reset-scores', async (_req, res) => {
  await db.resetAllScores();
  res.json({ success: true });
});

module.exports = router;
