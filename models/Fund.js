const mongoose = require('mongoose');

const fundSchema = new mongoose.Schema({
  // сюда накапливается общий призовой пул (в мавродиках)
  total: { type: Number, default: 0 },
}, { collection: 'fund' });

module.exports = mongoose.model('Fund', fundSchema);