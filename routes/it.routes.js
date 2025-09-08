const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

/**
 * ✅ IT Department Login
 */
router.post("/login", (req, res) => {
  const db = req.app.get("db");
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: "Username and password required" });
  }

  const sql = "SELECT * FROM it_admins WHERE username = ? LIMIT 1";
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error("❌ IT Login DB Error:", err.sqlMessage);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (results.length === 0) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const admin = results[0];
    const match = await bcrypt.compare(password, admin.password);

    if (!match) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    delete admin.password;
    res.json({ success: true, admin });
  });
});

/**
 * ✅ Get all deactivated students
 */
router.get("/students/deactivated", (req, res) => {
  const db = req.app.get("db");
  const sql = `
    SELECT 
      s.id, 
      s.registration_no, 
      s.name, 
      s.email, 
      s.semester,
      d.name AS department_name,
      sec.name AS section_name
    FROM students s
    LEFT JOIN department d ON s.department_id = d.id
    LEFT JOIN section sec ON s.section_id = sec.id
    WHERE s.is_active = 0
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err.sqlMessage);
      return res.status(500).json({ success: false, message: "DB error", error: err.sqlMessage });
    }

    res.json({ success: true, students: results });
  });
});

/**
 * ✅ Reactivate student
 */
router.post("/students/reactivate", (req, res) => {
  const db = req.app.get("db");
  const { studentId } = req.body;

  if (!studentId) {
    return res.json({ success: false, message: "Student ID required" });
  }

  const sql = "UPDATE students SET is_active = 1 WHERE id = ?";
  db.query(sql, [studentId], (err) => {
    if (err) {
      console.error("❌ Reactivate Error:", err.sqlMessage);
      return res.status(500).json({ success: false, message: "DB error", error: err.sqlMessage });
    }

    res.json({ success: true, message: "Student reactivated successfully" });
  });
});

module.exports = router;
