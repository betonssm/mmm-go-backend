const express = require("express");
const router = express.Router();
const Player = require("../models/Player");

router.get("/:telegramId", async (req, res) => {
  const player = await Player.findOne({ telegramId: req.params.telegramId });
  if (!player) return res.status(404).send("Игрок не найден");
  res.json(player);
});

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