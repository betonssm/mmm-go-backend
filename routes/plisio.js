const express = require("express");
const router = express.Router();
const axios = require("axios");
const qs = require("qs"); // <== ОБЯЗАТЕЛЬНО для сериализации
const Player = require("../models/Player");

router.post("/create-payment", async (req, res) => {
  console.log("→ [plisio] /create-payment BODY:", req.body);
  const { telegramId, amount } = req.body;

  try {
    const payload = {
      shop_id: process.env.PLISIO_SHOP_ID,
      amount: amount || 10,
      currency: "USDT",
      source_currency: "USDT",
      order_name: "MMM GO Premium",
      order_number: telegramId,
      type: "crypto",
      callback_url: "https://mmmgo-backend.onrender.com/plisio/callback",
      redirect_to: "https://mmmgo-frontend.onrender.com/payment-success",
      cancel_url: "https://mmmgo-frontend.onrender.com/payment-failed",
    };

    const response = await axios.post(
      "https://plisio.net/api/v1/invoices/new",
      qs.stringify(payload), // ✅ сериализуем тело
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${process.env.PLISIO_API_KEY}`,
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    -    console.error("❌ Ошибка создания платежа:", err.response?.data || err.message);
    +    console.error("❌ [plisio] error.response.data:", err.response?.data);
    +    console.error("❌ [plisio] err.message         :", err.message);
        res.status(500).json({ error: "Ошибка создания платежа" });
      }
});
// ✅ Обработка callback
router.post("/callback", async (req, res) => {
  console.log("→ [plisio] /callback BODY:", req.body);
  const { order_number, status } = req.body;

  if (status === "completed") {
    const telegramId = order_number;
    await Player.findOneAndUpdate({ telegramId }, { isInvestor: true });
    console.log("✅ Пользователь стал инвестором:", telegramId);
  }

  res.sendStatus(200);
});

module.exports = router;