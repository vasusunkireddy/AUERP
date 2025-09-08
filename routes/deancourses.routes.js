const express = require("express");
const router = express.Router();

// Get all courses
router.get("/courses", (req, res) => {
  const db = req.app.get("db");
  const sql = `
    SELECT c.id, c.code, c.name, c.credits, c.semester,
           d.id AS department_id, d.name AS department_name
    FROM course c
    JOIN department d ON c.department_id = d.id
    ORDER BY c.id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB error", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(results);
  });
});

// Add a course
router.post("/courses", (req, res) => {
  const db = req.app.get("db");
  const { code, name, credits, semester, department_id } = req.body;
  if (!code || !name || !credits || !semester || !department_id) {
    return res.status(400).json({ message: "Missing fields" });
  }

  db.query(
    "INSERT INTO course (code, name, credits, semester, department_id) VALUES (?, ?, ?, ?, ?)",
    [code, name, credits, semester, department_id],
    (err, result) => {
      if (err) {
        console.error("DB error", err);
        return res.status(500).json({ message: "DB error" });
      }
      res.json({ id: result.insertId, code, name, credits, semester, department_id });
    }
  );
});

// Update a course
router.put("/courses/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { code, name, credits, semester, department_id } = req.body;
  if (!code || !name || !credits || !semester || !department_id) {
    return res.status(400).json({ message: "Missing fields" });
  }

  db.query(
    "UPDATE course SET code=?, name=?, credits=?, semester=?, department_id=? WHERE id=?",
    [code, name, credits, semester, department_id, id],
    (err, result) => {
      if (err) {
        console.error("DB error", err);
        return res.status(500).json({ message: "DB error" });
      }
      if (result.affectedRows === 0) return res.status(404).json({ message: "Course not found" });
      res.json({ message: "Course updated successfully" });
    }
  );
});

// Delete a course
router.delete("/courses/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  db.query("DELETE FROM course WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("DB error", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course deleted successfully" });
  });
});

module.exports = router;
