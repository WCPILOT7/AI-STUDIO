module.exports = async (req, res) => {
  res.json({ key: process.env.FAL_API_KEY || null });
};
