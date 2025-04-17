const express = require("express");
const router = express.Router();
const axios = require("axios");
const Player = require("../models/Player"); // Убедись, что путь корректный

// ✅ Создание платежа
router.post("/create-payment", async (req, res) => {
  const { telegramId, amount } = req.body;

  try {
    const response = await axios.post("https://plisio.net/api/v1/invoices/new", null, {
      params: {
        shop_id: process.env.PLISIO_SHOP_ID,
        amount,
        currency: "USD",
        order_name: "MMM GO Premium",
        order_number: telegramId,
        callback_url: "https://mmmgo-backend.onrender.com/plisio/callback",
        success_url: "https://mmmgo-frontend.onrender.com/PaymentSuccess",
        cancel_url: "https://mmmgo-frontend.onrender.com/PaymentFailed",
      },
      headers: {
        Authorization: `Bearer ${process.env.PLISIO_API_KEY}`,
      },
    });

    res.json(response.data);
  } catch (err) {
    console.error("❌ Ошибка создания платежа:", err.response?.data || err);
    res.status(500).json({ error: "Ошибка создания платежа" });
  }
});

// ✅ Обработка callback после успешной оплаты
router.post("/callback", async (req, res) => {
  const { order_number, status } = req.body;

  if (status === "completed") {
    const telegramId = order_number;
    await Player.findOneAndUpdate({ telegramId }, { isInvestor: true });
    console.log("✅ Пользователь стал инвестором:", telegramId);
  }

  res.sendStatus(200);
});

module.exports = router;