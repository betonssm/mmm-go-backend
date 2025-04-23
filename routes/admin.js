const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const Fund = require("../models/Fund");
const authMiddleware = require("../middleware/checkAdmin");

// 🔒 Применяем защиту ко всем admin-маршрутам
router.use(authMiddleware);

// Список всех игроков
router.get("/players", async (req, res) => {
  const players = await Player.find({}, { playerName: 1, balance: 1, isInvestor: 1, level: 1, srRating: 1, telegramId: 1 });
  res.json(players);
});

// Детали конкретного игрока
router.get("/player/:telegramId", async (req, res) => {
  const player = await Player.findOne({ telegramId: req.params.telegramId });
  if (!player) return res.status(404).json({ error: "Игрок не найден" });
  res.json(player);
});

// Принудительный сброс всех миссий
router.post("/reset-missions", async (req, res) => {
  await Player.updateMany({}, {
    $set: {
      "weeklyMission.current": 0,
      "weeklyMission.completed": false,
      "dailyTasks.dailyTaps": 0,
      "dailyTasks.rewardReceived": false,
    }
  });
  res.json({ status: "Миссии сброшены" });
});

// Статистика по игрокам и фонду
router.get("/overview", async (req, res) => {
  const totalPlayers = await Player.countDocuments();
  const fund = await Fund.findOne();
  const players = await Player.find({}, { telegramId: 1, playerName: 1, balance: 1, level: 1, isInvestor: 1, srRating: 1 });
  res.json({ totalPlayers, fundTotal: fund?.total || 0, players });
});

module.exports = router;