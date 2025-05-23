const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  // Идентификатор Telegram
  telegramId:       { type: Number, required: true, unique: true },
  // Никнейм или имя игрока
  playerName:       { type: String },

  // Основной баланс мавродиков (внутриигровая валюта)
  balance:          { type: Number, default: 0 },

  // Уровень игрока
  level:            { type: Number, default: 0 },
  // Флаг активации ускорителя
  isBoostActive:    { type: Boolean, default: false },

  // ---------------------------------------------
  // Премиум-подписка (инвестор)
  // ---------------------------------------------
  // Флаг премиум-игрока (инвестора)
  isInvestor:       { type: Boolean, default: false },
  // Дата начала текущей подписки
  premiumSince:     { type: Date,    default: null },
  // Дата истечения текущей подписки
  premiumExpires:   { type: Date,    default: null },
  srActiveSince:   { type: Date,    default: null },
  donatesCount: { type: Number, default: 0 },

  // ---------------------------------------------
  // SR-рейтинговые очки начисляются только в период действия премиума
  // и сбрасываются ежемесячно
  // ---------------------------------------------
  srRating:         { type: Number, default: 0 },
  srMonth: { type: String, default: null }, // например, "2024-06"
    srStartBalance: { type: Number, default: 0 },
  srStartReferrals: { type: Number, default: 0 },
  srStartDonates: { type: Number, default: 0 },

  // Количество рефералов
  referrals:        { type: Number, default: 0 },
  refSource: { type: Number, default: null }, 
  refBonusBuffer: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 }, // Буфер накопления бонусов от рефералов// Telegram ID пригласившего

  // ---------------------------------------------
  // Статистика активностей
  // ---------------------------------------------
  totalTaps:        { type: Number, default: 0 },
  adsWatched:       { type: Number, default: 0 },
  boostCooldownUntil:{ type: Date,   default: null },

  // ---------------------------------------------
  // Партнерские подписки и бонусы
  // ---------------------------------------------
  partnerSubscribed: { type: Boolean, default: false },

  // Ежедневные задания
  dailyTasks: {
    dailyTaps:      { type: Number, default: 0 },
    dailyTarget:    { type: Number, default: 5000 },
    rewardReceived: { type: Boolean, default: false },
  },

  // Еженедельные миссии
  weeklyMission: {
    mavrodikGoal: { type: Number, default: 100000 },
    current:      { type: Number, default: 0 },
    completed:    { type: Boolean, default: false },
  },

  // Боносный баланс (дополнительные начисления)
  balanceBonus:      { type: Number, default: 0 },
  lastDailyRewardAt: { type: Date,   default: null },
  lastWeeklyRewardAt:{ type: Date,   default: null },
  lastPrizeAt: { type: Date, default: null },
  walletAddressTRC20: { type: String, default: null },
  tonWallet: { type: String, default: null },
  processedTxs: { type: [String], default: [] },
  mmmgoTokenBalance: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model("Player", playerSchema);
