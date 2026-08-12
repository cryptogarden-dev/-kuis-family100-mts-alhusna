const express = require('express');
const router  = express.Router();
const db      = require('../database');

// GET all questions
router.get('/', async (_req, res) => res.json(await db.getQuestions()));

// GET single question
router.get('/:id', async (req, res) => {
  const q = await db.getQuestion(+req.params.id);
  if (!q) return res.status(404).json({ error: 'Soal tidak ditemukan' });
  res.json(q);
});

// POST create question
router.post('/', async (req, res) => {
  const { question, time_limit, category, answers } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Soal tidak boleh kosong' });
  const q = await db.addQuestion({ question: question.trim(), time_limit, category, answers });
  res.status(201).json(q);
});

// PUT update question
router.put('/:id', async (req, res) => {
  const q = await db.updateQuestion(+req.params.id, req.body);
  if (!q) return res.status(404).json({ error: 'Soal tidak ditemukan' });
  res.json(q);
});

// DELETE question
router.delete('/:id', async (req, res) => {
  const ok = await db.deleteQuestion(+req.params.id);
  if (!ok) return res.status(404).json({ error: 'Soal tidak ditemukan' });
  res.json({ success: true });
});

// POST import soal dari format teks
router.post('/import', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Teks tidak boleh kosong' });

  const imported = [];
  const errors   = [];
  const blocks   = text.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let question   = '';
    let time_limit = 60;
    let category   = 'Umum';
    const answers  = [];
    let inAnswers  = false;

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('SOAL:')) {
        question = line.replace(/^SOAL:\s*/i, '').trim();
      } else if (upper.startsWith('WAKTU:')) {
        time_limit = parseInt(line.replace(/^WAKTU:\s*/i, '')) || 60;
      } else if (upper.startsWith('KATEGORI:')) {
        category = line.replace(/^KATEGORI:\s*/i, '').trim();
      } else if (upper.startsWith('JAWABAN:')) {
        inAnswers = true;
      } else if (inAnswers || line.includes('|')) {
        const cleaned = line.replace(/^\d+[\.\)]\s*/, '');
        const parts   = cleaned.split('|');
        const answer  = parts[0].trim();
        const points  = parts[1] ? parseInt(parts[1].trim()) || 10 : 10;
        if (answer) answers.push({ answer, points });
      }
    }

    if (!question) {
      errors.push(`Block tidak memiliki SOAL: "${lines[0].substring(0, 40)}..."`);
      continue;
    }
    if (answers.length === 0) {
      errors.push(`Soal "${question.substring(0, 40)}..." tidak memiliki jawaban`);
      continue;
    }

    await db.addQuestion({ question, time_limit, category, answers });
    imported.push(question);
  }

  res.json({ success: true, imported: imported.length, questions: imported, errors });
});

module.exports = router;
