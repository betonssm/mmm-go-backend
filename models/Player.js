const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  playerName: { type: String },
  // Основной баланс мавродиков (используется для начисления и трат)
  balance: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  isBoostActive: { type: Boolean, default: false },
  // Флаг премиум-игрока (инвестора)
  isInvestor: { type: Boolean, default: false },
  // Дата начала премиум-статуса (для ежемесячного распределения фонда)
  premiumSince: { type: Date, default: null },
  srRating: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },

  totalTaps: { type: Number, default: 0 },
  adsWatched: { type: Number, default: 0 },
  boostCooldownUntil: { type: Date, default: null },

  partnerSubscribed: { type: Boolean, default: false },
  dailyTasks: {
    dailyTaps: { type: Number, default: 0 },
    dailyTarget: { type: Number, default: 5000 },
    rewardReceived: { type: Boolean, default: false },
  },
  weeklyMission: {
    mavrodikGoal: { type: Number, default: 100000 },
    current: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  // Дополнительный призовой баланс (bonus)
  balanceBonus: { type: Number, default: 0 },
  lastDailyRewardAt: { type: Date, default: null },
  lastWeeklyRewardAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("Player", playerSchema);