require("dotenv").config();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const Player = require("../models/Player");

// POST /plisio/create-payment
router.post("/create-payment", async (req, res) => {
  // 1) Логируем входящий запрос
  console.log("→ [plisio] /create-payment BODY:", req.body);
  const { telegramId, amount } = req.body;

  // 2) Формируем query-параметры для Plisio
  const params = {
    api_key:               process.env.PLISIO_API_KEY,             // ваш секретный ключ
    shop_id:               process.env.PLISIO_SHOP_ID,             // ваш ID магазина
    order_name:            "MMM GO Premium",                       // описание заказа
    order_number:          telegramId,                              // будем использовать Telegram ID
    source_currency:       "USDT_TRX",                                   // сумма в долларах
    source_amount:         amount || 10,                            // default 10 USD
    callback_url:          "https://mmmgo-backend.onrender.com/plisio/callback",
    success_invoice_url:   "https://mmmgo-frontend.onrender.com/payment-success",
    fail_invoice_url:      "https://mmmgo-frontend.onrender.com/payment-failed",
    allowed_psys_cids:     "USDT,ETH,BTC",                          // разрешённые криптовалюты
  };

  try {
    // 3) Делаем GET‑запрос к Plisio API
    const { data } = await axios.get(
      "https://api.plisio.net/api/v1/invoices/new",
      { params }
    );

    // 4) Отдаём клиенту JSON с invoice_url и прочей инфой
    return res.json(data);

  } catch (err) {
    // 5) Логируем, что вернул Plisio и собственное сообщение
    console.error("❌ [plisio] error.response.data:", err.response?.data);
    console.error("❌ [plisio] err.message         :", err.message);

    // 6) Отправляем клиенту ответ с кодом ошибки и деталями
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