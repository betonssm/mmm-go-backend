const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const Log = require("../models/Log"); // в самом верху файла
const Config = require("../models/Config");

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
        partnerSubscribed: false,
        refSource: refId || null,
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
    // 🪵 Логируем действие игрока
await Log.create({
  type: "player",
  message: "Обновление данных игрока",
  playerId: telegramId,
  data: req.body,
});
    console.log("📥 Получены данные игрока (POST):", req.body);
    console.log("🧪 Игрок из базы:", {
      weeklyMission: player.weeklyMission,
      dailyTasks: player.dailyTasks,
      lastWeeklyRewardAt: player.lastWeeklyRewardAt,
    });
    if (!player) return res.status(404).json({ error: "Игрок не найден" });

    const now = new Date();

// 📆 Сброс недельной миссии
const weekStart = new Date(now);
weekStart.setHours(0, 0, 0, 0);
weekStart.setDate(weekStart.getDate() - weekStart.getDay());

if (player.lastWeeklyRewardAt && new Date(player.lastWeeklyRewardAt) < weekStart) {
  console.log("🔄 Новая неделя — сбрасываем weeklyMission");
  player.weeklyMission.current = 0;
  player.weeklyMission.completed = false;
  player.lastWeeklyRewardAt = null;
  await player.save();
}

// ☀️ Сброс дневной награды (если новый день)
const lastDaily = player.lastDailyRewardAt ? new Date(player.lastDailyRewardAt).toDateString() : null;
const today = now.toDateString();

if (lastDaily !== today && player.dailyTasks?.rewardReceived) {
  console.log("☀️ Новый день — сбрасываем dailyTasks.rewardReceived");
  player.dailyTasks.rewardReceived = false;
  await player.save();
}
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
      console.log("✅ Обнаружен balanceBonus:", balanceBonus);
      incFields.balance = balanceBonus;
    
      // ✅ Прогресс недельной миссии — только если не завершена
      if (!player.weeklyMission?.completed) {
        incFields["weeklyMission.current"] = (incFields["weeklyMission.current"] || 0) + balanceBonus;
      } else {
        console.log("⛔ Миссия завершена — weekly прогресс не увеличиваем");
      }
    
      // ✅ Прогресс дневной миссии — всегда
      if (typeof player.dailyTasks?.dailyTaps === "number") {
        incFields["dailyTasks.dailyTaps"] = (incFields["dailyTasks.dailyTaps"] || 0) + balanceBonus;
      } else {
        console.log("⚠️ dailyTasks.dailyTaps не найден — прогресс не обновлён");
        console.log("📦 balanceBonus:", balanceBonus);
        console.log("🧩 incFields после balanceBonus:", incFields);
      }
    }
  
    
    // === Начисление 10% бонуса пригласившему ===
    if (player.refSource && balanceBonus > 0) {
      const bonus = balanceBonus * 0.1;
      const referrer = await Player.findOne({ telegramId: player.refSource });
    
      if (referrer) {
        const newBuffer = (referrer.refBonusBuffer || 0) + bonus;
        const wholeCoins = Math.floor(newBuffer);
        const remaining = newBuffer - wholeCoins;
    
        const update = { refBonusBuffer: remaining };
    
        if (wholeCoins > 0) {
          update.balance = (referrer.balance || 0) + wholeCoins;
          update["weeklyMission.current"] = (referrer.weeklyMission?.current || 0) + wholeCoins;
          update.referralEarnings = (referrer.referralEarnings || 0) + wholeCoins;
        }
        console.log("📦 Финальный updateQuery:", {
          $set: updateFields,
          $inc: incFields,
        });
    
        await Player.updateOne({ telegramId: referrer.telegramId }, { $set: update });
    
        if (wholeCoins > 0) {
          console.log(`🎁 Пригласивший ${referrer.telegramId} получил ${wholeCoins} мавродиков от ${telegramId}`);
        }
      }
    }

    if (dailyTasks) {
      const lastDaily = player.lastDailyRewardAt ? new Date(player.lastDailyRewardAt).toDateString() : null;
      const today = now.toDateString();
    
      const DAILY_BONUS = 5000;
    
      if (dailyTasks.rewardReceived && lastDaily !== today) {
        updateFields["dailyTasks.rewardReceived"] = true;
        updateFields.lastDailyRewardAt = now;
        incFields.balance = (incFields.balance || 0) + DAILY_BONUS;
      }
    } 
    if (weeklyMission) {
    const getWeekNumber = date => {
        const oneJan = new Date(date.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((date - oneJan + 86400000) / 86400000);
        return Math.ceil((dayOfYear + oneJan.getDay()) / 7);
      };

      const lastWeek = player.lastWeeklyRewardAt ? getWeekNumber(new Date(player.lastWeeklyRewardAt)) : null;
const currWeek = getWeekNumber(now);

if (weeklyMission?.completed) {
  const WEEKLY_BONUS = 10000;

  const lastReward = player.lastWeeklyRewardAt ? new Date(player.lastWeeklyRewardAt) : null;
  const sameWeek = lastReward && getWeekNumber(lastReward) === getWeekNumber(now);

  if (!sameWeek) {
    console.log("🎁 Награда за недельную миссию выдана");
    updateFields["weeklyMission.completed"] = true;
    updateFields.lastWeeklyRewardAt = now;
    incFields.balance = (incFields.balance || 0) + WEEKLY_BONUS;
  } else {
    console.log("⛔ Награда уже получена ранее — игнорируем повтор");
  }

  // Защита от ручной подмены weeklyMission.current
  delete updateFields["weeklyMission.current"];
  delete incFields["weeklyMission.current"];
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
    // Убираем возможный конфликт Mongo: $set + $inc на одном объекте
if (incFields["dailyTasks.dailyTaps"]) {
  delete updateFields.dailyTasks;
}

    const updateQuery = {};
    if (Object.keys(updateFields).length) updateQuery.$set = updateFields;
    if (Object.keys(incFields).length) updateQuery.$inc = incFields;

    const updated = await Player.findOneAndUpdate(
      { telegramId },
      updateQuery,
      { new: true }
    );

    res.json({
      ...player.toObject(),
      refSourceSaved: player.refSource !== null,
    });
  } catch (err) {
    console.error("❌ Ошибка сохранения игрока:", err);
    res.status(500).json({ error: "Ошибка сохранения игрока", details: err });
  }
  }
);
// POST /player/set-ref
router.post("/set-ref", async (req, res) => {
  try {
    const { telegramId, refSource } = req.body;

    if (!telegramId || !refSource) {
      return res.status(400).json({ error: "Недостаточно данных" });
    }

    const player = await Player.findOne({ telegramId });

    if (!player) {
      return res.status(404).json({ error: "Игрок не найден" });
    }

    if (!player.refSource) {
      player.refSource = refSource;
      await player.save();
      console.log(`🔗 refSource ${refSource} установлен игроку ${telegramId}`);
      res.json({ success: true });
    } else {
      console.log(`ℹ️ Игрок ${telegramId} уже имеет refSource (${player.refSource})`);
      res.json({ success: false, message: "Уже установлен" });
    }
  } catch (error) {
    console.error("❌ Ошибка в /player/set-ref:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});
router.post("/player/claim-prize", async (req, res) => {
  const { telegramId, prizeAmount } = req.body;

  if (!telegramId || typeof prizeAmount !== "number") {
    return res.status(400).json({ error: "Недостаточно данных" });
  }

  const player = await Player.findOne({ telegramId });
  if (!player) return res.status(404).json({ error: "Игрок не найден" });

  const now = new Date();
  const lastClaim = player.lastPrizeAt;

  if (lastClaim && lastClaim.toDateString() === now.toDateString()) {
    return res.status(400).json({ error: "Вы уже получали приз сегодня" });
  }

  // Прибавляем приз к балансу
  player.balance += prizeAmount;

  // Обновим только недельную миссию (дневную мы не трогаем)
  if (player.weeklyMission && !player.weeklyMission.completed) {
    player.weeklyMission.current += prizeAmount;
  }

  // Обновляем дату последнего розыгрыша
  player.lastPrizeAt = now;

  await player.save();

  res.json({ success: true, newBalance: player.balance });
});
// POST /player/wallet — сохранение адреса TRC20 кошелька
router.post("/wallet", async (req, res) => {
  const { telegramId, walletAddressTRC20 } = req.body;

  if (!telegramId || !walletAddressTRC20) {
    return res.status(400).json({ error: "Недостаточно данных" });
  }

  // Простая валидация формата TRC20 (начинается с T и длина 34 символа)
  if (!walletAddressTRC20.startsWith("T") || walletAddressTRC20.length !== 34) {
    return res.status(400).json({ error: "Неверный формат адреса TRC20" });
  }

  try {
    const player = await Player.findOneAndUpdate(
      { telegramId },
      { walletAddressTRC20 },
      { new: true }
    );

    if (!player) {
      return res.status(404).json({ error: "Игрок не найден" });
    }

    console.log(`💳 Кошелёк TRC20 обновлён для ${telegramId}: ${walletAddressTRC20}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Ошибка при сохранении адреса TRC20:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});
// Публичный маршрут для WebApp — проверка статуса
router.get("/status", async (req, res) => {
  try {
    const config = await Config.findOne();
    console.log("CONFIG:", config); // ← проверь вывод
    const maintenance = config?.maintenanceMode || false;
    res.json({ maintenance });
  } catch (err) {
    console.error("Ошибка получения статуса:", err);
    res.status(500).json({ maintenance: false });
  }
});


module.exports = router;
