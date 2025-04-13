const express = require("express");
const router = express.Router();
const Player = require("../models/Player");

// ⬇️ GET с авто-созданием и учётом реферала
router.get("/:telegramId", async (req, res) => {
  try {
    let player = await Player.findOne({ telegramId: req.params.telegramId });

    if (!player) {
      // Новый игрок
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
      });

      await player.save();
      console.log("🆕 Новый игрок создан:", player);

      // Учёт реферала
      if (refId && refId !== req.params.telegramId) {
        const referrer = await Player.findOne({ telegramId: refId });
        if (referrer) {
          referrer.referrals += 1;
          await referrer.save();
          console.log(`👥 Реферал засчитан! ${refId} пригласил ${req.params.telegramId}`);
        }
      }
    }

    res.json(player);
  } catch (err) {
    console.error("Ошибка при получении игрока:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ⬇️ POST — обновление игрока и расчёт SR рейтинга
router.post("/", async (req, res) => {
  const {
    telegramId,
    playerName,
    balance,
    level,
    isBoostActive,
    isInvestor,
    referrals,
    totalTaps,
    adsWatched
  } = req.body;

  try {
    // 💡 Расчёт логарифмического SR-рейтинга
    const srRating = Math.floor(
      Math.log2((referrals || 0) + 1) * 40 +
      Math.log2((totalTaps || 0) + 1) * 25 +
      Math.log2((adsWatched || 0) + 1) * 35
    );

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
        srRating
      },
      { upsert: true, new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error("Ошибка сохранения игрока:", err);
    res.status(500).json({ error: "Ошибка сохранения игрока", details: err });
  }
});

module.exports = router;