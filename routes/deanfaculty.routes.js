const express = require("express");
const router = express.Router();

// Get all faculty
router.get("/faculty", (req, res) => {
  const db = req.app.get("db");
  const sql = `
    SELECT f.id, f.user_id, f.name, f.email, f.mobile, f.photo,
           f.department_id, d.name AS department_name
    FROM faculty f
    JOIN department d ON f.department_id = d.id
    ORDER BY f.id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// Add faculty
router.post("/faculty", (req, res) => {
  const db = req.app.get("db");
  const { user_id, name, email, mobile, photo, department_id } = req.body;
  if (!user_id || !name || !email || !mobile || !department_id) {
    return res.status(400).json({ message: "Missing fields" });
  }

  db.query(
    "INSERT INTO faculty (user_id, name, email, mobile, photo, department_id) VALUES (?, ?, ?, ?, ?, ?)",
    [user_id, name, email, mobile, photo || null, department_id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "DB error" });
      }
      res.json({ id: result.insertId, user_id, name, email, mobile, photo, department_id });
    }
  );
});

// Update faculty
router.put("/faculty/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { user_id, name, email, mobile, photo, department_id } = req.body;

  if (!user_id || !name || !email || !mobile || !department_id) {
    return res.status(400).json({ message: "Missing fields" });
  }

  db.query(
    "UPDATE faculty SET user_id = ?, name = ?, email = ?, mobile = ?, photo = ?, department_id = ? WHERE id = ?",
    [user_id, name, email, mobile, photo || null, department_id, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: "DB error" });
      if (result.affectedRows === 0) return res.status(404).json({ message: "Faculty not found" });
      res.json({ message: "Faculty updated successfully" });
    }
  );
});

// Delete faculty
router.delete("/faculty/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  db.query("DELETE FROM faculty WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Faculty not found" });
    res.json({ message: "Faculty deleted successfully" });
  });
});

module.exports = router;
