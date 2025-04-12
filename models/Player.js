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
}, { timestamps: true });

module.exports = mongoose.model("Player", playerSchema);