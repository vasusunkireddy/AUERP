const express = require("express");
const router = express.Router();

/**
 * 🔹 Get faculty profile by ID
 */
router.get("/profile/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  const sql = `
    SELECT id, name, email, photo 
    FROM faculty 
    WHERE id = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("❌ DB error (profile)", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Faculty not found" });
    }

    const faculty = results[0];
    res.json({
      id: faculty.id,
      name: faculty.name,
      email: faculty.email,
      photo: faculty.photo || "https://i.postimg.cc/fbVwm1L2/Bon.jpg"
    });
  });
});

module.exports = router;
