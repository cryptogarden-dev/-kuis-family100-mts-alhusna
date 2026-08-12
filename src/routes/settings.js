const express = require('express');
const router  = express.Router();
const db      = require('../database');
const ah      = require('../asyncHandler');

router.get('/', ah(async (_req, res) => res.json(await db.getSettings())));
router.put('/', ah(async (req, res) => res.json(await db.updateSettings(req.body))));

module.exports = router;
