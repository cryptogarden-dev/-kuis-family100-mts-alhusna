const express = require('express');
const router  = express.Router();
const db      = require('../database');

router.get('/', async (_req, res) => res.json(await db.getSettings()));
router.put('/', async (req, res) => res.json(await db.updateSettings(req.body)));

module.exports = router;
