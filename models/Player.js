const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  playerName: { type: String },
  balance: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  isBoostActive: { type: Boolean, default: false },
  isInvestor: { type: Boolean, default: false },
  srRating: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },

  totalTaps: { type: Number, default: 0 },
  adsWatched: { type: Number, default: 0 },
  boostCooldownUntil: { type: Date, default: null },

  // 🔽 Добавляем сюда:
  partnerSubscribed: { type: Boolean, default: false },
  dailyTasks: {
    dailyTaps: { type: Number, default: 0 },
    dailyTarget: { type: Number, default: 5000 },
    rewardReceived: { type: Boolean, default: false },
  },
  weeklyMission: {
    mavrodikGoal: { type: Number, default: 1000000 },
    current: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  balanceBonus: { type: Number, default: 0 } // ⬅️ вот это

}, { timestamps: true });

module.exports = mongoose.model("Player", playerSchema);