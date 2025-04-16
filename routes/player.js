const express = require("express");
const router = express.Router();
const Player = require("../models/Player");

// ✅ Сначала GET /count
router.get("/count", async (req, res) => {
  try {
    const count = await Player.countDocuments();
    res.json({ totalPlayers: count });
  } catch (err) {
    res.status(500).json({ error: "Ошибка при получении количества игроков" });
  }
});

// ⬇️ Потом GET /:telegramId с учётом реферала
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
        srRating: 0,
        referrals: 0,
        totalTaps: 0,
        adsWatched: 0,
        boostCooldownUntil: null,
      });

      await player.save();
      console.log("🆕 Новый игрок создан:", player);

      if (refId && refId !== req.params.telegramId) {
        try {
          const referrer = await Player.findOne({ telegramId: refId });
          if (referrer) {
            referrer.referrals += 1;
            referrer.balance += 5000; // 💸 Бонус за реферала
            await referrer.save();
            console.log(`👥 Реферал засчитан! ${refId} пригласил ${req.params.telegramId}`);
          }
        } catch (err) {
          console.error("❌ Ошибка при начислении бонуса за реферала:", err);
        }
      }
    }
// Если нет dailyTasks — создаём базу
if (!player.dailyTasks) {
  player.dailyTasks = {
    dailyTaps: 0,
    dailyTarget: 5000,
    rewardReceived: false
  };
}

// Аналогично для weeklyMission
if (!player.weeklyMission) {
  player.weeklyMission = {
    mavrodikGoal: 1000000,
    current: 0,
    completed: false
  };
}

// Подписка на партнёра
if (typeof player.partnerSubscribed === "undefined") {
  player.partnerSubscribed = false;
}

await player.save(); // Сохраняем обновления
    // ✅ Отправляем данные игрока в любом случае
    res.json(player);

  } catch (err) {
    console.error("Ошибка при получении игрока:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});
// ⬇️ POST — обновление игрока и SR рейтинг
router.post("/", async (req, res) => {
  console.log("📥 Получены данные задания (POST):", req.body); 
  const {
    telegramId,
    playerName,
    balance,
    level,
    isBoostActive,
    isInvestor,
    referrals,
    totalTaps,
    adsWatched,
    srRating,
    boostCooldownUntil,
    partnerSubscribed,
    dailyTasks,
    weeklyMission,
    balanceBonus // 👈 добавили!
  } = req.body;
  const player = await Player.findOne({ telegramId });

// Защита от повтора ежедневной награды
if (dailyTasks?.rewardReceived && player?.lastDailyRewardAt) {
  const now = new Date();
  const last = new Date(player.lastDailyRewardAt);
  const sameDay = now.toDateString() === last.toDateString();

  if (sameDay) {
    return res.status(400).json({ error: "Награда за сегодня уже получена" });
  }
}

// Защита от повтора недельной награды
if (weeklyMission?.completed && player?.lastWeeklyRewardAt) {
  const now = new Date();
  const last = new Date(player.lastWeeklyRewardAt);

  const sameWeek =
    now.getFullYear() === last.getFullYear() &&
    getWeekNumber(now) === getWeekNumber(last);

  if (sameWeek) {
    return res.status(400).json({ error: "Награда за эту неделю уже получена" });
  }
}

// Функция для определения номера недели
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

  const updateFields = {
    telegramId,
    playerName,
    level,
    isBoostActive,
    isInvestor,
    referrals,
    totalTaps,
    adsWatched,
    srRating,
    boostCooldownUntil: boostCooldownUntil || null
  };
  if (typeof dailyTasks !== "undefined" && dailyTasks.rewardReceived) {
    updateFields["dailyTasks"] = dailyTasks;
    updateFields["lastDailyRewardAt"] = new Date(); // сохраняем дату
    console.log("🕒 Дата ежедневной награды:", updateFields.lastDailyRewardAt);
  }
  if (typeof weeklyMission !== "undefined" && weeklyMission.completed) {
    updateFields["weeklyMission"] = weeklyMission;
    updateFields["lastWeeklyRewardAt"] = new Date(); // сохраняем дату
    console.log("📆 Дата недельной награды:", updateFields.lastWeeklyRewardAt);
  }

  // 👇 Применяем бонус к балансу
  if (typeof balanceBonus !== "undefined" && balanceBonus > 0) {
    const player = await Player.findOne({ telegramId });
    if (player) {
      updateFields.balance = (player.balance || 0) + balanceBonus;
    }
  } else if (typeof balance !== "undefined") {
    updateFields.balance = balance;
  }

  if (typeof partnerSubscribed !== "undefined") {
    updateFields.partnerSubscribed = partnerSubscribed;
  }

  if (dailyTasks) {
    updateFields.dailyTasks = dailyTasks;
  }

  if (weeklyMission) {
    updateFields.weeklyMission = weeklyMission;
  }

  try {
    const updated = await Player.findOneAndUpdate(
      { telegramId },
      updateFields,
      { upsert: true, new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("❌ Ошибка сохранения игрока:", err);
    res.status(500).json({ error: "Ошибка сохранения игрока", details: err });
  }
});

module.exports = router;