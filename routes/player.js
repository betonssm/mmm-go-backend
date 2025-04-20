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
          await Player.findOneAndUpdate(
            { telegramId: refId },
            {
              $inc: {
                referrals: 1,
                balance: 5000,
                "weeklyMission.current": 5000
              }
            }
          );
        }
      }
    }
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

// POST /player
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
    console.log("→ [player] до обработки: ", { updateFields, incFields });

    if (playerName) updateFields.playerName = playerName;
    if (typeof level !== "undefined") updateFields.level = level;
    if (typeof isBoostActive !== "undefined") updateFields.isBoostActive = isBoostActive;
    if (typeof referrals !== "undefined") updateFields.referrals = referrals;
    if (typeof totalTaps !== "undefined") updateFields.totalTaps = totalTaps;
    if (typeof adsWatched !== "undefined") updateFields.adsWatched = adsWatched;
    if (typeof boostCooldownUntil !== "undefined") updateFields.boostCooldownUntil = boostCooldownUntil || null;
    if (typeof partnerSubscribed !== "undefined") updateFields.partnerSubscribed = partnerSubscribed;

    if (typeof balanceBonus === "number" && balanceBonus > 0) {
      incFields.balance = balanceBonus;
    
      // ✅ Прогресс увеличиваем ТОЛЬКО если миссия не завершена
      if (!player.weeklyMission?.completed) {
        incFields["weeklyMission.current"] = balanceBonus;
      }
    }

    if (dailyTasks) {
      const lastDaily = player.lastDailyRewardAt ? new Date(player.lastDailyRewardAt).toDateString() : null;
      const today = now.toDateString();

      if (dailyTasks.rewardReceived && lastDaily !== today) {
        updateFields.dailyTasks = dailyTasks;
        updateFields.lastDailyRewardAt = now;
        const DAILY_BONUS = 5000;
        incFields.balance = (incFields.balance || 0) + DAILY_BONUS;
        incFields["weeklyMission.current"] = (incFields["weeklyMission.current"] || 0) + DAILY_BONUS;
      } else {
        updateFields.dailyTasks = dailyTasks;
      }
    }

    if (weeklyMission) {
      const getWeek = d => {
        const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const day = dt.getUTCDay() || 7;
        dt.setUTCDate(dt.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
        return Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
      };

      const getWeekNumber = date => {
        const oneJan = new Date(date.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((date - oneJan + 86400000) / 86400000);
        return Math.ceil((dayOfYear + oneJan.getDay()) / 7);
      };

      const lastWeek = player.lastWeeklyRewardAt ? getWeek(new Date(player.lastWeeklyRewardAt)) : null;
      const currWeek = getWeek(now);

      if (player.lastWeeklyRewardAt) {
        const lastReward = new Date(player.lastWeeklyRewardAt);
        const sameYear = lastReward.getFullYear() === now.getFullYear();
        const sameWeek = getWeekNumber(lastReward) === getWeekNumber(now);

        if (sameYear && sameWeek) {
          console.log("⛔ Недельная награда уже выдана в этом цикле");
          return res.status(400).json({ error: "Награда за неделю уже получена" });
        }
      }

      if (weeklyMission.completed) {
        updateFields["weeklyMission.current"] = weeklyMission.current;
        updateFields["weeklyMission.completed"] = weeklyMission.completed;
        updateFields.lastWeeklyRewardAt = now;
        const WEEKLY_BONUS = 10000;
        incFields.balance = (incFields.balance || 0) + WEEKLY_BONUS;

        if (incFields["weeklyMission.current"]) {
          delete incFields["weeklyMission.current"];
        }
      }
    }

    if (typeof srRating !== "undefined") {
      const active = player.isInvestor && player.premiumExpires && now < player.premiumExpires && player.srActiveSince && now >= player.srActiveSince;
      updateFields.srRating = active ? srRating : 0;
    }

    console.log("→ [player] updateQuery will be:", {
      ...(Object.keys(updateFields).length > 0 && { $set: updateFields }),
      ...(Object.keys(incFields).length > 0 && { $inc: incFields })
    });

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
