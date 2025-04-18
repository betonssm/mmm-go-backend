require("dotenv").config();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Player = require("../models/Player");
const Fund = require('../models/Fund');

// POST /plisio/create-payment
router.post("/create-payment", async (req, res) => {
  console.log("→ [plisio] /create-payment BODY:", req.body);
  const { telegramId, amount } = req.body;

  const params = {
    api_key:             process.env.PLISIO_API_KEY,
    shop_id:             process.env.PLISIO_SHOP_ID,
    order_name:          "MMM GO Premium",
    order_number:        telegramId,
    source_currency:     "USDT_TRX",
    source_amount:       amount || 10,
    callback_url:        "https://mmmgo-backend.onrender.com/plisio/callback",
    success_invoice_url: "https://mmmgo-frontend.onrender.com/payment-success",
    fail_invoice_url:    "https://mmmgo-frontend.onrender.com/payment-failed",
    allowed_psys_cids:   "USDT_TRX",
  };

  try {
    const { data } = await axios.get(
      "https://api.plisio.net/api/v1/invoices/new",
      { params }
    );
    return res.json(data);
  } catch (err) {
    console.error("❌ [plisio] error.response.data:", err.response?.data);
    console.error("❌ [plisio] err.message         :", err.message);
    return res
      .status(err.response?.status || 500)
      .json({ error: "Ошибка создания платежа", details: err.response?.data });
  }
});

// POST /plisio/callback
// При успешной оплате обновляем подписку
router.post("/callback", async (req, res) => {
  console.log("→ [plisio] /callback BODY:", req.body);
  const { order_number: telegramId, status } = req.body;

  if (status === "completed") {
    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + 30); // подписка на 30 дней
     // 60% от уплаченного доната идёт в призовой пул
  // source_amount — сумма в USD, mavroPerUsd = 50000/10 если 50k за $10
const mavroPerUsd = 50000 / 10;
const increment = source_amount * mavroPerUsd * 0.6;
await Fund.findOneAndUpdate({}, { $inc: { total: increment } });
console.log(`💰 Пул увеличен на ${increment} мавродиков`);

    const player = await Player.findOneAndUpdate(
      { telegramId },
      {
        isInvestor:     true,
        premiumSince:   now,
        premiumExpires: expires,
        $inc: { balance: 50000 },
        srRating:       0  // сброс рейтинга при продлении
      },
      { upsert: true, new: true }
    );

    console.log(
      `✅ ${telegramId} получил премиум до ${expires.toISOString()}, новый баланс=${player.balance}`
    );
  }

  res.sendStatus(200);
});

module.exports = router;
