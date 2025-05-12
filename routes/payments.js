const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const axios = require("axios");

const TON_ADDRESS = "UQDh-x69UU3p5DWPZ8Yz_4QMoTWwkAWYLMy6JoQSOPxLPT8A";

router.post("/check-ton", async (req, res) => {
  const { telegramId, type } = req.body;
  if (!telegramId || !type) return res.status(400).json({ error: "Недостаточно данных" });

  try {
    // Проверка входящих переводов (через TonAPI)
    const response = await axios.get(`https://tonapi.io/v2/blockchain/accounts/${TON_ADDRESS}/transactions?limit=10`, {
     headers: { Authorization: `Bearer ${process.env.TONAPI_TOKEN}` }, // если нужен API токен
    });

    const txs = response.data.transactions || [];
    const userTx = txs.find(tx =>
      tx.incoming_message?.source?.startsWith("0:") &&
      tx.incoming_message?.value &&
      parseFloat(tx.incoming_message.value) >= 1.4e9 // в nanotons
    );

    if (!userTx) return res.status(400).json({ error: "Платёж не найден" });

    const update = type === "premium"
      ? { isInvestor: true }
      : { $inc: { balance: 50000 } };

    await Player.updateOne({ telegramId }, update);

    return res.json({ ok: true });
  } catch (err) {
    console.error("TON check error:", err);
    res.status(500).json({ error: "Ошибка проверки оплаты" });
  }
});
router.post("/webhook-ton", async (req, res) => {
  try {
    const { event, transaction } = req.body;

    if (event !== "transaction_received") return res.sendStatus(200);

    const wallet = transaction?.in_msg?.source;
    const amountNano = Number(transaction?.in_msg?.value || 0);
    const amountTon = amountNano / 1e9;

    if (!wallet || amountTon < 1.4) {
      return res.status(400).json({ error: "Некорректные данные" });
    }

    const player = await Player.findOne({ tonWallet: wallet });
    if (!player) {
      console.warn("Не найден игрок с кошельком:", wallet);
      return res.sendStatus(404);
    }

    // 💰 Логика начислений
    if (amountTon >= 1.4 && amountTon < 2.0) {
      player.isInvestor = true;
    } else if (amountTon >= 2.0) {
      player.balance += 50000;
    }

    await player.save();

    console.log("✅ Оплата через TON получена от", wallet, "→", amountTon, "TON");

    return res.sendStatus(200);
  } catch (err) {
    console.error("TON Webhook Error:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
