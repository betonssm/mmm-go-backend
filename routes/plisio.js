require("dotenv").config();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Player = require("../models/Player");

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
router.post("/callback", async (req, res) => {
  console.log("→ [plisio] /callback BODY:", req.body);
  const { order_number: telegramId, status } = req.body;

  if (status === "completed") {
    const player = await Player.findOneAndUpdate(
      { telegramId },
      {
        isInvestor:   true,
        premiumSince: new Date(),      // дата оформления премиум
        $inc: { balance: 50000 },     // начисляем 50k мавродиков
      },
      { upsert: true, new: true }
    );
    console.log(
      "✅ Премиум оформлен и 50k зачислено:",
      telegramId,
      "новый баланс=",
      player.balance
    );
  }

  res.sendStatus(200);
});

module.exports = router;