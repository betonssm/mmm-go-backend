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

    // ✅ Отправляем данные игрока в любом случае
    res.json(player);

  } catch (err) {
    console.error("Ошибка при получении игрока:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;