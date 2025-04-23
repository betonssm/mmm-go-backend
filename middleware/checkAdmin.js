// middleware/checkAdmin.js
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader.split(" ")[1] !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};
