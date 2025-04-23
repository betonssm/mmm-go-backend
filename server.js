require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");
const Player = require("./models/Player");
const Fund = require('./models/Fund');
const fundRoutes = require('./routes/fund');
const app = express();
app.use(cors());
app.use(express.json());
app.use('/fund', fundRoutes);

// Платёжные маршруты
const plisioRoutes = require("./routes/plisio");
app.use("/plisio", plisioRoutes);

// Игровые маршруты
const playerRoutes = require("./routes/player");
app.use("/player", playerRoutes);
const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log("MongoDB подключен");
    // Инициализируем документ пула, если он ещё не создан
    const existing = await Fund.findOne();
    if (!existing) {
      await Fund.create({ total: 0 });
      console.log("🔰 Документ пула выплат инициализирован");
    }
  })
  .catch(err => console.error("Ошибка подключения к MongoDB:", err));
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));

// 🕓 Сброс ежедневных заданий каждый день в 00:00 UTC
cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Сброс ежедневных заданий...");
  try {
    await Player.updateMany({}, {
      $set: {
        "dailyTasks.dailyTaps": 0,
        "dailyTasks.rewardReceived": false,
        adsWatched: 0
      }
    });
    console.log("✅ Ежедневные задания сброшены");
  } catch (err) {
    console.error("❌ Ошибка сброса ежедневных заданий:", err);
  }
});

// 🕖 Сброс еженедельных миссий каждую неделю в понедельник в 00:00 UTC
cron.schedule("0 0 * * 1", async () => {
  console.log("📆 Сброс недельной миссии...");
  try {
    await Player.updateMany({}, {
      $set: {
        "weeklyMission.current": 0,
        "weeklyMission.completed": false
      }
    });
    console.log("✅ Еженедельные миссии сброшены");
  } catch (err) {
    console.error("❌ Ошибка сброса недельной миссии:", err);
  }
});

// 🕰️ Ежемесячное распределение фонда и сброс SR-рейтинга
// Формат: в ENV задать MONTHLY_FUND, по умолчанию 1000000
const MONTHLY_FUND = Number(process.env.MONTHLY_FUND) || 1000000;
cron.schedule("10 0 1 * *", async () => {
  console.log("⏰ Запуск ежемесячного распределения фонда...");
  const now = new Date();
  const firstDayLastMonth = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth() - 1, 1
  ));
  const firstDayThisMonth = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), 1
  ));
  try {
    const premiumPlayers = await Player.find({
      isInvestor: true,
       // SR‑рейтинги у этих игроков уже были активны с 1‑го числа прошлого месяца
  srActiveSince: { $lte: firstDayLastMonth },
  // А подписка началась до конца прошлого месяца
 premiumSince:  { $lt: firstDayThisMonth }
  
    }).sort({ srRating: -1 });

    if (!premiumPlayers.length) {
      console.log("⚠️ Нет премиум-игроков за прошлый месяц.");
    } else {
      const cutoffIndex = Math.ceil(premiumPlayers.length * 0.1);
      const topPlayers = premiumPlayers.slice(0, cutoffIndex);
      const share = Math.floor(MONTHLY_FUND / topPlayers.length);

      for (const p of topPlayers) {
        await Player.updateOne({ _id: p._id }, { $inc: { balance: share } });
      }
      console.log(`✅ Фонд ${MONTHLY_FUND} распределён между ${topPlayers.length} игроками, по ${share} мавродиков каждому.`);
    }
    // Сброс SR-рейтинга всех инвесторов
    await Player.updateMany({ isInvestor: true }, { $set: { srRating: 0 } });
    console.log("🔄 SR-рейтинги сброшены для инвесторов");
  } catch (err) {
    console.error("❌ Ошибка распределения ежемесячного фонда:", err);
  }
});