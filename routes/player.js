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
  console.log("📥 Получены данные задания:", req.body); // ✅ ВСТАВЬ СЮДА
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

    // 🔽 Новые поля
    dailyTasks,
    weeklyMission,
    partnerSubscribed,
    balanceBonus
  } = req.body;

  try {
    const updated = await Player.findOneAndUpdate(
      { telegramId },
      {
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
        boostCooldownUntil: boostCooldownUntil || null,

        // 🔽 Сохраняем новые поля
        ...(dailyTasks && { dailyTasks }),
        ...(weeklyMission && { weeklyMission }),
        ...(typeof partnerSubscribed !== "undefined" && { partnerSubscribed })
        (typeof balanceBonus !== "undefined" && { balanceBonus })
      },
      { upsert: true, new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("❌ Ошибка сохранения игрока:", err);
    res.status(500).json({ error: "Ошибка сохранения игрока", details: err });
  }
});

module.exports = router;