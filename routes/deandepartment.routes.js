const express = require("express");
const router = express.Router();

// Get all departments
router.get("/", (req, res) => {
  const db = req.app.get("db");
  db.query("SELECT * FROM department", (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(results);
  });
});

// Add a department
router.post("/", (req, res) => {
  const db = req.app.get("db");
  const { name, code, program_id = 1 } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: "Missing fields" });
  }

  db.query(
    "INSERT INTO department (program_id, name, code) VALUES (?, ?, ?)",
    [program_id, name, code],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            message: "Department with this code already exists in the program",
          });
        }
        console.error("DB error:", err);
        return res.status(500).json({ message: "DB error" });
      }
      res.json({ id: result.insertId, program_id, name, code });
    }
  );
});

// Update department
router.put("/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { name, code, program_id = 1 } = req.body;

  if (!name || !code) {
    return res.status(400).json({ message: "Missing fields" });
  }

  db.query(
    "UPDATE department SET program_id = ?, name = ?, code = ? WHERE id = ?",
    [program_id, name, code, id],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            message: "Department with this code already exists in the program",
          });
        }
        console.error("DB error:", err);
        return res.status(500).json({ message: "DB error" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json({ message: "Department updated successfully" });
    }
  );
});

// Delete department
router.delete("/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  db.query("DELETE FROM department WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Department not found" });
    }
    res.json({ message: "Department deleted successfully" });
  });
});

module.exports = router;
