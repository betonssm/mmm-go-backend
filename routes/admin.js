const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const Fund = require("../models/Fund");
const authMiddleware = require("../middleware/checkAdmin");
const Log = require("../models/Log");
const Config = require("../models/Config");
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
router.get('/sr-stats', async (req, res) => {
  try {
    const fundDoc = await Fund.findOne({});
    const fundUSDT = fundDoc?.total || 0;

    const allInvestors = await Player.find({
      isInvestor: true,
      premiumExpires: { $gt: new Date() },
      srRating: { $gt: 0 }
    });

    const sorted = allInvestors.sort((a, b) => b.srRating - a.srRating);
    const totalCount = sorted.length;

    const top1Count = Math.max(1, Math.floor(totalCount * 0.01));
    const top5Count = Math.max(1, Math.floor(totalCount * 0.05)) - top1Count;
    const top10Count = Math.max(1, Math.floor(totalCount * 0.10)) - top5Count - top1Count;

    const top1 = sorted.slice(0, top1Count);
    const top5 = sorted.slice(top1Count, top1Count + top5Count);
    const top10 = sorted.slice(top1Count + top5Count, top1Count + top5Count + top10Count);

    const fund1 = fundUSDT * 0.30;
    const fund5 = fundUSDT * 0.35;
    const fund10 = fundUSDT * 0.35;

    const formatPlayers = (group, list, payoutPerUser) => {
      return list.map(player => ({
        telegramId: player.telegramId,
        playerName: player.playerName,
        srRating: player.srRating,
        walletAddressTRC20: player.walletAddressTRC20 || null,
        group,
        usdtPayout: Number(payoutPerUser.toFixed(2))
      }));
    };

    const result = [
      ...formatPlayers('1%', top1, fund1 / top1.length),
      ...formatPlayers('2-5%', top5, fund5 / top5.length),
      ...formatPlayers('6-10%', top10, fund10 / top10.length)
    ];

    res.json({ total: fundUSDT, topPlayers: result });
  } catch (err) {
    console.error('Ошибка в /admin/sr-stats:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
// Получить состояние технических работ
router.get("/maintenance", async (req, res) => {
  const config = await Config.findOne() || new Config();
  res.json({ maintenanceMode: config.maintenanceMode });
});

// Изменить состояние технических работ
router.post("/maintenance", async (req, res) => {
  const { maintenanceMode } = req.body;
  let config = await Config.findOne();
  if (!config) config = new Config();
  config.maintenanceMode = !!maintenanceMode;
  await config.save();
  res.json({ success: true, maintenanceMode: config.maintenanceMode });
});
// POST /admin/add-balance
router.post("/add-balance", async (req, res) => {
  const { telegramId, amount } = req.body;

  if (!telegramId || !amount || isNaN(amount)) {
    return res.status(400).json({ error: "Неверные параметры" });
  }

  try {
    const result = await Player.updateOne(
      { telegramId },
      {
        $inc: {
          balance: amount,
          "weeklyMission.current": amount,
          "dailyTasks.dailyTaps": amount,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Игрок не найден" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Ошибка при добавлении баланса:", err);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});
// PUT /api/admin/fund — обновить сумму фонда вручную
router.put("/fund", async (req, res) => {
  const { newTotal } = req.body;
  if (typeof newTotal !== "number") return res.status(400).json({ error: "Неверное значение" });

  try {
    const fund = await Fund.findOne();
    if (!fund) return res.status(404).json({ error: "Фонд не найден" });

    fund.total = newTotal;
    await fund.save();

    res.json({ success: true, newTotal });
  } catch (err) {
    console.error("Ошибка обновления фонда:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});


module.exports = router;