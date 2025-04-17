require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const plisioRoutes = require("./routes/plisio");
app.use("/plisio", plisioRoutes);

const app = express();
app.use(cors());
app.use(express.json());

const playerRoutes = require("./routes/player");
app.use("/player", playerRoutes);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB подключен"))
  .catch(err => console.error("Ошибка подключения к MongoDB:", err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
const cron = require("node-cron");
const Player = require("./models/Player");

// 🕓 Сброс ежедневных заданий каждый день в 00:00 по UTC
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

// 🕖 Сброс еженедельных заданий каждую неделю в понедельник в 00:00
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