const mongoose = require("mongoose");

const configSchema = new mongoose.Schema({
  maintenanceMode: {
    type: Boolean,
    default: false,
  }
});

module.exports = mongoose.model("Config", configSchema);