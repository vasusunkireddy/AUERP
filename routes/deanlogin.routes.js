const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

router.post("/login", (req, res) => {
  const db = req.app.get("db");
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ message: "User ID and Password are required" });
  }

  const query = "SELECT * FROM dean WHERE user_id = ?";
  db.query(query, [userId], async (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const dean = results[0];
    const match = await bcrypt.compare(password, dean.password);

    if (match) {
      return res.json({ message: "Login successful", user: { id: dean.id, userId: dean.user_id } });
    } else {
      return res.status(401).json({ message: "Invalid credentials" });
    }
  });
});

module.exports = router;
