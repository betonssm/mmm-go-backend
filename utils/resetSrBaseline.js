
const Player = require("../models/Player");

module.exports = async function resetSrBaseline() {
  const now = new Date();
  const result = await Player.updateMany(
    {
      isInvestor: true,
      premiumExpires: { $gte: now },
      srActiveSince: { $lte: now }
    },
    [
      {
        $set: {
          srStartBalance: "$balance",
          srStartReferrals: "$referrals",
          srStartDonates: "$donates"
        }
      }
    ]
  );
  console.log(`✅ SR baseline обновлён для ${result.modifiedCount} игроков`);
  return result.modifiedCount;
};
