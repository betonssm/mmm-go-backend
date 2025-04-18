const express = require("express");
const router = express.Router();
const Player = require("../models/Player");

// GET /player/count - общее количество игроков
router.get("/count", async (req, res) => {
  try {
    const count = await Player.countDocuments();
    res.json({ totalPlayers: count });
  } catch (err) {
    res.status(500).json({ error: "Ошибка при получении количества игроков" });
  }
});

// GET /player/:telegramId - получение или создание игрока
router.get("/:telegramId", async (req, res) => {
  try {
    let player = await Player.findOne({ telegramId: req.params.telegramId });
    if (!player) {
      const refId = req.query.ref;
      player = new Player({
        telegramId: req.params.telegramId,
        playerName: "Новый игрок",
        balance: 0,
        level: 0,
        isBoostActive: false,
        isInvestor: false,
        premiumSince: null,
        premiumExpires: null,
        srRating: 0,
        referrals: 0,
        totalTaps: 0,
        adsWatched: 0,
        boostCooldownUntil: null,
        partnerSubscribed: false
      });
      await player.save();
      console.log("🆕 Новый игрок создан:", player);

      if (refId && refId !== req.params.telegramId) {
        const referrer = await Player.findOne({ telegramId: refId });
        if (referrer) {
          referrer.referrals += 1;
          referrer.balance += 5000;
          await referrer.save();
          console.log(`👥 Реферал засчитан: ${refId} -> ${req.params.telegramId}`);
        }
      }
    }

    // Инициализация структур
    if (!player.dailyTasks) player.dailyTasks = { dailyTaps: 0, dailyTarget: 5000, rewardReceived: false };
    if (!player.weeklyMission) player.weeklyMission = { mavrodikGoal: 100000, current: 0, completed: false };
    if (typeof player.partnerSubscribed === "undefined") player.partnerSubscribed = false;
    await player.save();
    res.json(player);
  } catch (err) {
    console.error("Ошибка при получении игрока:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /player - обновление полей игрока с атомарным инкрементом баланса
router.post("/", async (req, res) => {
  console.log("📥 Получены данные игрока (POST):", req.body);
  const {
    telegramId,
    playerName,
    level,
    isBoostActive,
    referrals,
    totalTaps,
    adsWatched,
    boostCooldownUntil,
    partnerSubscribed,
    dailyTasks,
    weeklyMission,
    balanceBonus,
    srRating,
  } = req.body;

  try {
    const player = await Player.findOne({ telegramId });
    if (!player) return res.status(404).json({ error: "Игрок не найден" });

    const now = new Date();
    const updateFields = {};
    const incFields = {};

    // Обновляем базовые поля
    if (playerName) updateFields.playerName = playerName;
    if (typeof level !== "undefined") updateFields.level = level;
    if (typeof isBoostActive !== "undefined") updateFields.isBoostActive = isBoostActive;
    if (typeof referrals !== "undefined") updateFields.referrals = referrals;
    if (typeof totalTaps !== "undefined") updateFields.totalTaps = totalTaps;
    if (typeof adsWatched !== "undefined") updateFields.adsWatched = adsWatched;
    if (typeof boostCooldownUntil !== "undefined") updateFields.boostCooldownUntil = boostCooldownUntil || null;
    if (typeof partnerSubscribed !== "undefined") updateFields.partnerSubscribed = partnerSubscribed;

    // Атомарный инкремент баланса
    if (typeof balanceBonus === "number" && balanceBonus > 0) {
      incFields.balance = balanceBonus;
    }

    // Ежедневные задачи
    if (dailyTasks) {
      const lastDaily = player.lastDailyRewardAt ? new Date(player.lastDailyRewardAt).toDateString() : null;
      if (!(dailyTasks.rewardReceived && lastDaily === now.toDateString())) {
        updateFields.dailyTasks = dailyTasks;
        if (dailyTasks.rewardReceived) updateFields.lastDailyRewardAt = now;
      }
    }

    // Еженедельные миссии
    if (weeklyMission) {
      const getWeek = d => { const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = dt.getUTCDay() || 7; dt.setUTCDate(dt.getUTCDate() + 4 - day); const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1)); return Math.ceil(((dt - yearStart) / 86400000 + 1) / 7); };
      const lastWeek = player.lastWeeklyRewardAt ? getWeek(new Date(player.lastWeeklyRewardAt)) : null;
      const currWeek = getWeek(now);
      if (!(weeklyMission.completed && lastWeek === currWeek)) {
        updateFields.weeklyMission = weeklyMission;
        if (weeklyMission.completed) updateFields.lastWeeklyRewardAt = now;
      }
    }

    // SR-рейтинги только при активной подписке
    if (typeof srRating !== "undefined") {
      if (player.isInvestor && player.premiumExpires && now < new Date(player.premiumExpires)) {
        updateFields.srRating = srRating;
      } else {
        updateFields.srRating = 0;
      }
    }

    // Сборка запроса: $set и $inc
    const updateQuery = {};
    if (Object.keys(updateFields).length) updateQuery.$set = updateFields;
    if (Object.keys(incFields).length) updateQuery.$inc = incFields;

    const updated = await Player.findOneAndUpdate(
      { telegramId },
      updateQuery,
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("❌ Ошибка сохранения игрока:", err);
    res.status(500).json({ error: "Ошибка сохранения игрока", details: err });
  }
});

module.exports = router;
