const express = require('express');
const router  = express.Router();
const db      = require('../database');

router.get('/',  (_req, res) => res.json(db.getSettings()));
router.put('/',  (req, res)  => res.json(db.updateSettings(req.body)));

module.exports = router;
