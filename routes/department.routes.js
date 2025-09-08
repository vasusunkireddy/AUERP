const express = require("express");
const router = express.Router();

// Get all departments
router.get("/", (req, res) => {
  const db = req.app.get("db");
  db.query("SELECT * FROM department", (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// Add a department
router.post("/", (req, res) => {
  const db = req.app.get("db");
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ message: "Missing fields" });

  db.query("INSERT INTO department (name, code) VALUES (?, ?)", [name, code], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json({ id: result.insertId, name, code });
  });
});

module.exports = router;
