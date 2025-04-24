// models/Log.js
const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  type: String, // например "info", "error", "player", "referral"
  message: String,
  playerId: Number, // необязательно
  data: Object, // можно сохранить payload
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Log", logSchema);