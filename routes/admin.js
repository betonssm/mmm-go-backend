const express = require("express");
const router = express.Router();
const checkAdmin = require("../middleware/checkAdmin");
const Player = require("../models/Player");
const Fund = require("../models/Fund");

// Защищённый маршрут
router.get("/overview", checkAdmin, async (req, res) => {
  try {
    const players = await Player.find().select("telegramId playerName balance level isInvestor srRating");
    const fund = await Fund.findOne();

    res.json({
      totalPlayers: players.length,
      fundTotal: fund?.total || 0,
      players
    });
  } catch (err) {
    console.error("❌ Ошибка получения статистики:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;