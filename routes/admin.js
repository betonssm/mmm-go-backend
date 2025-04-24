const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const Fund = require("../models/Fund");
const authMiddleware = require("../middleware/checkAdmin");

// 🔒 Применяем защиту ко всем admin-маршрутам
router.use(authMiddleware);

// Список всех игроков
router.get("/players", async (req, res) => {
  const players = await Player.find({}, { playerName: 1, balance: 1, isInvestor: 1, level: 1, srRating: 1, telegramId: 1, premiumExpires: 1,  referrals: 1,
    refSource: 1, paymentsCount: 1, });
  res.json(players);
});

// Детали конкретного игрока
router.get("/player/:telegramId", async (req, res) => {
  const player = await Player.findOne({ telegramId: req.params.telegramId });
  if (!player) return res.status(404).json({ error: "Игрок не найден" });
  res.json(player);
});

// Принудительный сброс всех миссий
router.post("/reset-missions/:telegramId", async (req, res) => {
  const { telegramId } = req.params;

  const player = await Player.findOne({ telegramId });
  if (!player) return res.status(404).json({ error: "Игрок не найден" });

  player.weeklyMission = { mavrodikGoal: 100000, current: 0, completed: false };
  player.dailyTasks = { dailyTaps: 0, dailyTarget: 5000, rewardReceived: false };
  player.adsWatched = 0;

  await player.save();

  if (updated.modifiedCount > 0) {
    console.log(`🧹 Миссии сброшены для игрока ${telegramId}`);
    res.json({ status: `Миссии сброшены для игрока ${telegramId}` });
  } else {
    console.warn(`⚠️ Не удалось сбросить миссии — игрок ${telegramId} не найден`);
    res.status(404).json({ error: "Игрок не найден или не изменён" });
  }
});

// Статистика по игрокам и фонду
router.get("/overview", async (req, res) => {
  const totalPlayers = await Player.countDocuments();
  const fund = await Fund.findOne();
  const players = await Player.find({}, { telegramId: 1, playerName: 1, balance: 1, level: 1, isInvestor: 1, srRating: 1, premiumExpires: 1,   referrals: 1,
    refSource: 1, paymentsCount: 1, });
  res.json({ totalPlayers, fundTotal: fund?.total || 0, players });
});
// Получение логов
router.get("/logs", async (req, res) => {
  const logs = await Log.find().sort({ timestamp: -1 }).limit(100);
  res.json(logs);
});

module.exports = router;