const express = require("express");
const router = express.Router();

// Get all programs
router.get("/programs", (req, res) => {
  const db = req.app.get("db");
  db.query("SELECT * FROM program", (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// Get departments by program
router.get("/programs/:id/departments", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  db.query("SELECT * FROM department WHERE program_id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// Get all batches
router.get("/batches", (req, res) => {
  const db = req.app.get("db");
  db.query("SELECT * FROM batch", (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// Get all sections
router.get("/sections", (req, res) => {
  const db = req.app.get("db");
  const sql = `
    SELECT 
      s.id,
      s.name AS section_name,
      s.semester,
      d.id AS department_id, d.name AS department_name,
      p.id AS program_id, p.name AS program_name,
      b.id AS batch_id,
      CONCAT(b.start_year, '-', b.end_year) AS batch_name
    FROM section s
    JOIN department d ON s.department_id = d.id
    JOIN program p ON d.program_id = p.id
    JOIN batch b ON s.batch_id = b.id
    ORDER BY s.id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// Add section
router.post("/sections", (req, res) => {
  const db = req.app.get("db");
  const { department_id, batch_id, semester, name } = req.body;

  if (!department_id || !batch_id || !semester || !name) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const sql = `INSERT INTO section (department_id, batch_id, semester, name) VALUES (?, ?, ?, ?)`;
  db.query(sql, [department_id, batch_id, semester, name], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json({ id: result.insertId, department_id, batch_id, semester, name });
  });
});

// Update section
router.put("/sections/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { department_id, batch_id, semester, name } = req.body;

  if (!department_id || !batch_id || !semester || !name) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const sql = `UPDATE section SET department_id=?, batch_id=?, semester=?, name=? WHERE id=?`;
  db.query(sql, [department_id, batch_id, semester, name, id], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Section not found" });
    res.json({ message: "✅ Section updated successfully" });
  });
});

// Delete section
router.delete("/sections/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  db.query("DELETE FROM section WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Section not found" });
    res.json({ message: "✅ Section deleted successfully" });
  });
});

module.exports = router;
