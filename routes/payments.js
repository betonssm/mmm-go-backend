const express = require("express");
const router = express.Router();
router.use(express.json());

const Player = require("../models/Player");
const Fund = require("../models/Fund");
const axios = require("axios");

const TON_ADDRESS = "UQDh-x69UU3p5DWPZ8Yz_4QMoTWwkAWYLMy6JoQSOPxLPT8A";
function getPremiumExpireDate(dateBuy = new Date()) {
  // dateBuy — дата покупки или текущая дата
  let year = dateBuy.getFullYear();
  let month = dateBuy.getMonth() + 1; // следующий месяц
  if (month > 11) {
    year += 1;
    month = 0;
  }
  // 0-й день следующего месяца = последний день месяца
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

// ✅ Проверка вручную после оплаты
router.post("/check-ton", async (req, res) => {
  const { telegramId, type } = req.body;
  if (!telegramId || !type) return res.status(400).json({ error: "Недостаточно данных" });

  try {
    const response = await axios.get(`https://tonapi.io/v2/blockchain/accounts/${TON_ADDRESS}/transactions?limit=10`, {
      headers: { Authorization: `Bearer ${process.env.TONAPI_TOKEN}` },
    });

    const txs = response.data.transactions || [];
    const userTx = txs.find(tx =>
      tx.incoming_message?.source?.startsWith("0:") &&
      tx.incoming_message?.value &&
      parseFloat(tx.incoming_message.value) >= 1.2e9 // 1.2 TON в nanotons
    );

    if (!userTx) return res.status(400).json({ error: "Платёж не найден" });
    const player = await Player.findOne({ telegramId });
let fromDate = new Date();
if (player.premiumExpires && player.premiumExpires > new Date()) {
  fromDate = player.premiumExpires;
}
const update = type === "premium"
  ? {
      $set: {
        isInvestor: true,
        premiumSince: player.premiumSince || new Date(),
        premiumExpires: getPremiumExpireDate(fromDate)
      },
          $inc: { balance: 50000, 
           "weeklyMission.current": 50000 // ✅ добавляем прогресс миссии
           }
        }
      : { $inc: { balance: 50000, 
       "weeklyMission.current": 50000 // ✅ добавляем прогресс миссии
       }
};
    await Player.updateOne({ telegramId }, update);

    // ➕ Добавляем в фонд
  const fundDoc = await Fund.findOne();
if (fundDoc) {
  fundDoc.total += 6;
  await fundDoc.save();
  console.log("💰 Фонд увеличен на $6 (через /check-ton)");
}
    

    return res.json({ ok: true });
  } catch (err) {
    console.error("TON check error:", err);
    res.status(500).json({ error: "Ошибка проверки оплаты" });
  }
});

// ✅ Webhook от TonAPI
router.post("/webhook-ton", async (req, res) => {
  console.log("📬 Вызван webhook-ton ✅", JSON.stringify(req.body, null, 2));

  try {
    const { event_type, tx_hash } = req.body;
    if (event_type !== "account_tx" || !tx_hash) return res.sendStatus(200);

    const txDetailsRes = await axios.get(`https://tonapi.io/v2/blockchain/transactions/${tx_hash}`, {
      headers: { Authorization: `Bearer ${process.env.TONAPI_TOKEN}` }
    });

    const tx = txDetailsRes.data;
    console.log("🔬 Полные данные транзакции:", JSON.stringify(tx, null, 2));
    // 🛡 Защита от некорректных транзакций без адреса отправителя
if (!tx.in_msg || tx.in_msg.msg_type !== "int_msg" || !tx.in_msg.source?.address) {
  console.warn("❌ Пропущена транзакция без исходящего адреса:", tx_hash);
  return res.sendStatus(200);
}
// Защита от повторной обработки по tx_hash
const alreadyHandled = await Player.findOne({ processedTxs: tx.hash });
if (alreadyHandled) {
  console.warn("⚠️ Транзакция уже обработана ранее:", tx.hash);
  return res.sendStatus(200);
}



// ✅ Извлекаем адрес кошелька

    const rawWallet = tx.in_msg?.source?.address;
    const normalizeAddress = (addr) => addr?.toLowerCase()?.replace(/^0:/, '');
    const txWallet = normalizeAddress(rawWallet);

    const amountNano = Number(tx.in_msg?.value || 0);
    const amountTon = amountNano / 1e9;

    console.log("📩 Детали транзакции:", { txWallet, amountTon, tx_hash });

    if (!txWallet || amountTon < 1.0) return res.status(400).json({ error: "Недостаточно данных" });

    const player = await Player.findOne({ tonWallet: { $regex: new RegExp(`^${txWallet}$`, 'i') } });
    if (!player) {
      console.warn("❌ Не найден игрок с кошельком:", txWallet);
      return res.sendStatus(404);
    }
        // ✅ Проверка на уже обработанный tx_hash
    if (player.processedTxs?.includes(tx_hash)) {
      console.log("🔁 Уже обработанная транзакция:", tx_hash);
      return res.sendStatus(200);
    }

    if (amountTon >= 1.0 && amountTon < 2.0) {
  player.isInvestor = true;
  player.premiumSince = player.premiumSince || new Date();
  
  // ПРОДЛЕНИЕ от даты окончания, если подписка уже есть!
  let fromDate = new Date();
  if (player.premiumExpires && player.premiumExpires > new Date()) {
    fromDate = player.premiumExpires;
  }
  player.premiumExpires = getPremiumExpireDate(fromDate);

      player.balance = (player.balance || 0) + 50000;
        // ✅ Увеличиваем прогресс недельной миссии
  if (player.weeklyMission && !player.weeklyMission.completed) {
    player.weeklyMission.current = (player.weeklyMission.current || 0) + 50000;
  }
      console.log(`🎉 Подписка активирована до ${player.premiumExpires.toISOString()}`);
    } else if (amountTon >= 2.0) {
      player.balance = (player.balance || 0) + 50000;
        // ✅ Увеличиваем прогресс недельной миссии
  if (player.weeklyMission && !player.weeklyMission.completed) {
    player.weeklyMission.current = (player.weeklyMission.current || 0) + 50000;
  }
      console.log("💸 Пополнение: +50000 мавродиков");
    }
    // Сохраняем обработанный tx_hash
player.processedTxs = [tx.hash, ...(player.processedTxs || [])].slice(0, 20);

    await player.save();

    // ➕ Обновляем фонд
    const fundDoc = await Fund.findOne();
    if (fundDoc) {
      fundDoc.total += 6;
await fundDoc.save();
console.log("💰 Фонд увеличен на $6");
    }

    console.log("✅ Оплата через TON обработана:", { txWallet, amountTon });
    res.sendStatus(200);
  } catch (err) {
    console.error("TON Webhook Error:", err);
    res.sendStatus(500);
  }
});

module.exports = router;
