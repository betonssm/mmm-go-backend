const express = require("express");
const router = express.Router();
router.use(express.json());
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
  console.log("📬 Вызван webhook-ton ✅", JSON.stringify(req.body, null, 2));
  try {
    const { event_type, tx_hash } = req.body;

if (event_type !== "account_tx" || !tx_hash) {
  return res.sendStatus(200);
}

// 🔍 Получаем детали транзакции
const txDetailsRes = await axios.get(`https://tonapi.io/v2/blockchain/transactions/${tx_hash}`, {
  headers: {
    Authorization: `Bearer ${process.env.TONAPI_TOKEN}`
  }
});

const tx = txDetailsRes.data;
const wallet = tx.in_msg?.source || tx.incoming_message?.source;
const amountNano = Number(tx.in_msg?.value || tx.incoming_message?.value || 0);
const amountTon = amountNano / 1e9;

console.log("📩 Детали транзакции:", { wallet, amountTon, tx_hash });

if (!wallet || amountTon < 1.0) {
  return res.status(400).json({ error: "Недостаточно данных" });
}

const player = await Player.findOne({ tonWallet: wallet });
if (!player) {
  console.warn("❌ Не найден игрок с кошельком:", wallet);
  return res.sendStatus(404);
}

if (amountTon >= 1.0 && amountTon < 2.0) {
  player.isInvestor = true;
} else if (amountTon >= 2.0) {
  player.balance += 50000;
}

await player.save();

console.log("✅ Оплата через TON обработана:", { wallet, amountTon });
res.sendStatus(200);
  } catch (err) {
    console.error("TON Webhook Error:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
