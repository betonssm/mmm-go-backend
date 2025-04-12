const express = require("express");
const router = express.Router();
const Player = require("../models/Player");

// ⬇️ GET с авто-созданием
router.get("/:telegramId", async (req, res) => {
  try {
    let player = await Player.findOne({ telegramId: req.params.telegramId });

    if (!player) {
      player = new Player({
        telegramId: req.params.telegramId,
        playerName: "Новый игрок",
        balance: 0,
        level: 0,
        isBoostActive: false,
        isInvestor: false,
        srRating: 0,
        referrals: 0,
      });

      await player.save();
      console.log("🆕 Новый игрок создан:", player);
    }

    res.json(player);
  } catch (err) {
    console.error("Ошибка при получении игрока:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ⬇️ POST — обновление игрока
router.post("/", async (req, res) => {
  const { telegramId, playerName, balance, level, isBoostActive, isInvestor, srRating, referrals } = req.body;

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
        srRating,
        referrals,
      },
      { upsert: true, new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Ошибка сохранения игрока", details: err });
  }
});

module.exports = router;