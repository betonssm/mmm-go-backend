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
    shop_id:               process.env.PLISIO_SHOP_ID,
    source_currency:       "USDT",
    source_amount:         amount || 10,
    currency:              "USDT",
    order_name:            "MMM GO Premium",
    order_number:          telegramId,
    callback_url:          "https://mmmgo-backend.onrender.com/plisio/callback",
    success_invoice_url:   "https://mmmgo-frontend.onrender.com/payment-success",
    fail_invoice_url:      "https://mmmgo-frontend.onrender.com/plisio/cancel", 
    api_key:               process.env.PLISIO_API_KEY,
  };

  try {
    const response = await axios.get(
      "https://api.plisio.net/api/v1/invoices/new",
      { params }
    );
    return res.json(response.data);
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
  const { order_number, status } = req.body;

  if (status === "completed") {
    await Player.findOneAndUpdate(
      { telegramId: order_number },
      { isInvestor: true }
    );
    console.log("✅ Пользователь стал инвестором:", order_number);
  }

  res.sendStatus(200);
});

module.exports = router;