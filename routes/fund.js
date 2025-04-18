// routes/fund.js
const express = require('express');
const router = express.Router();
const Fund = require('../models/Fund');

router.get('/', async (req, res) => {
  try {
    const fund = await Fund.findOne();
    res.json({ total: fund.total });
  } catch (err) {
    console.error("Ошибка чтения пула:", err);
    res.status(500).json({ error: "Не удалось получить пул выплат" });
  }
  
});

module.exports = router;