const express = require("express");
const router = express.Router();
const Player = require("../models/Player");

router.post("/reset-sr-baseline", async (req, res) => {
  try {
    const now = new Date();

    const result = await Player.updateMany(
      {
        isInvestor: true,
        premiumExpires: { $gte: now },
        srActiveSince: { $lte: now }
      },
      [
        {
          $set: {
            srStartBalance: "$balance",
            srStartReferrals: "$referrals",
            srStartDonates: "$donates"
          }
        }
      ]
    );

    console.log(`✅ SR baseline обновлён для ${result.modifiedCount} игроков`);
    res.json({ ok: true, updated: result.modifiedCount });
  } catch (err) {
    console.error("❌ Ошибка при обновлении SR baseline:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;