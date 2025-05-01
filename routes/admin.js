const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const Fund = require("../models/Fund");
const authMiddleware = require("../middleware/checkAdmin");
const Log = require("../models/Log");
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
router.get("/analytics", async (req, res) => {
  const totalPlayers = await Player.countDocuments();
  const fund = await Fund.findOne();
  const investors = await Player.countDocuments({ isInvestor: true });

  const players = await Player.find({});
  const averageBalance = players.reduce((sum, p) => sum + (p.balance || 0), 0) / players.length;
  const averageSR = players.reduce((sum, p) => sum + (p.srRating || 0), 0) / players.length;

  res.json({
    totalPlayers,
    fundTotal: fund?.total || 0,
    investors,
    averageBalance: Math.round(averageBalance),
    averageSR: Math.round(averageSR),
  });
});
router.get("/sr-stats", async (req, res) => {
  try {
    const all = await Player.find({
      srRating: { $gt: 0 },
      isInvestor: true,
      premiumExpires: { $gt: new Date() }
    }).sort({ srRating: -1 });

    const totalCount = all.length;
    const top1Count = Math.ceil(totalCount * 0.01);
    const top5Count = Math.ceil(totalCount * 0.05);
    const top10Count = Math.ceil(totalCount * 0.10);

    const top1 = all.slice(0, top1Count);
    const top5 = all.slice(top1Count, top5Count);
    const top10 = all.slice(top5Count, top10Count);

    const sumSR = (list) => list.reduce((sum, p) => sum + p.srRating, 0);

    const totalTopSR = sumSR(top1) + sumSR(top5) + sumSR(top10);

    res.json({
      totalPlayers: totalCount,
      top1: top1.map(p => ({ ...p.toObject(), group: "1%" })),
      top5: top5.map(p => ({ ...p.toObject(), group: "2-5%" })),
      top10: top10.map(p => ({ ...p.toObject(), group: "6-10%" })),
      srSummary: {
        top1: sumSR(top1),
        top5: sumSR(top5),
        top10: sumSR(top10),
        totalTopSR
      }
    });
  } catch (err) {
    console.error("Ошибка получения SR статистики:", err);
    res.status(500).json({ error: "Ошибка получения SR статистики" });
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
  const logs = await Log.find().sort({ timestamp: -1 }).limit(300);
  res.json(logs);
});
router.get("/analytics", authMiddleware, async (req, res) => {
  try {
    const [
      totalPlayers,
      totalReferrals,
      activeSubs,
      topups,
      dailyMissions,
      weeklyMissions,
      richPlayers
    ] = await Promise.all([
      Player.countDocuments(),
      Player.countDocuments({ referrals: { $gt: 0 } }),
      Player.countDocuments({ premiumExpires: { $gt: new Date() } }),
      Player.countDocuments({ topupCount: { $gt: 0 } }),
      Player.countDocuments({ "dailyTasks.claimed": true }),
      Player.countDocuments({ "weeklyMission.claimed": true }),
      Player.countDocuments({ balance: { $gte: 5000000 } })
    ]);

    res.json({
      totalPlayers,
      totalReferrals,
      activeSubs,
      topups,
      dailyMissions,
      weeklyMissions,
      richPlayers
    });
  } catch (err) {
    console.error("Ошибка аналитики:", err);
    res.status(500).json({ error: "Ошибка получения аналитики" });
  }
});

module.exports = router;