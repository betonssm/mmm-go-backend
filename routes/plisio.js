require("dotenv").config();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Player = require("../models/Player");
const Fund = require('../models/Fund');

// POST /plisio/create-payment
router.post("/create-payment", async (req, res) => {
  const { telegramId, amount } = req.body;

  console.log("→ [plisio] Запрос на создание платежа:", {
    telegramId,
    amount: amount || 10,
    currency: "USDT.TRC20"
  });

  const params = {
    api_key:             process.env.PLISIO_API_KEY,
    shop_id:             process.env.PLISIO_SHOP_ID,
    order_name:          "MMM GO Premium",
    source_currency:     "USD", 
    order_number:        telegramId,
    return_existing:     1,
    source_amount:       amount || 10,
    callback_url:        "https://mmmgo-backend.onrender.com/plisio/callback",
    success_invoice_url: "https://mmmgo-frontend.onrender.com/payment-success",
    fail_invoice_url:    "https://mmmgo-frontend.onrender.com/payment-failed",
    allowed_psys_cids:   "USDT_TRX"
  };

  try {
    const { data } = await axios.get(
      "https://api.plisio.net/api/v1/invoices/new",
      { params }
    );
    return res.json(data);
  } catch (err) {
    const safeError = { ...err.response?.data };
    if (safeError?.data?.api_key) {
      safeError.data.api_key = "[HIDDEN]";
    }

    console.error("❌ [plisio] Ошибка создания платежа:", safeError || err.message);

    return res
      .status(err.response?.status || 500)
      .json({ error: "Ошибка создания платежа", details: safeError || err.message });
  }
});

// POST /plisio/callback
router.post("/callback", async (req, res) => {
  console.log("→ [plisio] Callback от Plisio:", {
    order_number: req.body.order_number,
    status: req.body.status
  });

  const { order_number: telegramId, status } = req.body;

  if (status === "completed") {
    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + 30);

    const srStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const sourceAmount = parseFloat(req.body.source_amount) || 10;
    const usdtIncrement = sourceAmount * 0.6;

    await Fund.findOneAndUpdate({}, { $inc: { total: usdtIncrement } });
    console.log(`💰 Пул увеличен на ${usdtIncrement.toFixed(2)} USDT`);

    const player = await Player.findOneAndUpdate(
      { telegramId },
      {
        isInvestor: true,
        premiumSince: now,
        premiumExpires: expires,
        srActiveSince: srStart,
        $inc: {
          balance: 50000,
          "weeklyMission.current": 50000
        },
        srRating: 0
      },
      { upsert: true, new: true }
    );

    console.log(`✅ ${telegramId} получил премиум до ${expires.toISOString()}, SR начнётся ${srStart.toISOString()}, баланс=${player.balance}`);
  }

  res.sendStatus(200);
});

// 🔹 Новый маршрут: создание платежа для покупки 50 000 мавродиков
router.post("/create-balance-payment", async (req, res) => {
  const { telegramId } = req.body;

  const params = {
    api_key: process.env.PLISIO_API_KEY,
    shop_id: process.env.PLISIO_SHOP_ID,
    order_name: "Покупка 50 000 мавродиков",
    source_currency: "USD",
    order_number: `${telegramId}_buyMavro`, // ⬅ отличие
    return_existing: 1,
    source_amount: 10,
    callback_url: "https://mmmgo-backend.onrender.com/plisio/callback",
    success_invoice_url: "https://mmmgo-frontend.onrender.com/payment-success",
    fail_invoice_url: "https://mmmgo-frontend.onrender.com/payment-failed",
    allowed_psys_cids: "USDT_TRX"
  };

  try {
    const { data } = await axios.get("https://api.plisio.net/api/v1/invoices/new", { params });
    res.json(data);
  } catch (err) {
    const safeError = { ...err.response?.data };
    if (safeError?.data?.api_key) safeError.data.api_key = "[HIDDEN]";
    console.error("❌ [plisio] Ошибка создания buy-coins платежа:", safeError || err.message);
    res.status(500).json({ error: "Ошибка при создании платежа на покупку мавродиков", details: safeError || err.message });
  }
});

// 🔹 Callback для buy-coins
router.post("/callback", async (req, res) => {
  console.log("📩 Поступил callback:", req.body);

  const { order_number, status, source_amount } = req.body;

  if (status !== "completed" || !order_number) {
    return res.sendStatus(200); // неуспешный платёж — игнорируем
  }

  // === 📌 Покупка мавродиков ===
  if (order_number.endsWith("_buyMavro")) {
    const match = order_number.match(/^(\d+)_buyMavro$/);
    if (!match) return res.sendStatus(400);

    const telegramId = parseInt(match[1], 10);
    const BONUS = 50000;

    const player = await Player.findOneAndUpdate(
      { telegramId },
      {
        $inc: {
          balance: BONUS,
          "weeklyMission.current": BONUS
        }
      },
      { new: true }
    );

    console.log(`💸 Игрок ${telegramId} ДОКУПИЛ 50 000 мавродиков. Новый баланс: ${player.balance}`);
    return res.sendStatus(200);
  }

  // === 📌 Подписка (по умолчанию) ===
  const telegramId = parseInt(order_number);
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + 30);

  const srStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const usdtIncrement = parseFloat(source_amount) * 0.6 || 6;

  await Fund.findOneAndUpdate({}, { $inc: { total: usdtIncrement } });
  console.log(`💰 Пул увеличен на ${usdtIncrement.toFixed(2)} USDT`);

  const player = await Player.findOneAndUpdate(
    { telegramId },
    {
      isInvestor: true,
      premiumSince: now,
      premiumExpires: expires,
      srActiveSince: srStart,
      $inc: {
        balance: 50000,
        "weeklyMission.current": 50000
      },
      srRating: 0
    },
    { upsert: true, new: true }
  );

  console.log(`✅ ${telegramId} получил премиум до ${expires.toISOString()}, SR начнётся ${srStart.toISOString()}, баланс=${player.balance}`);

  res.sendStatus(200);
});



module.exports = router;
