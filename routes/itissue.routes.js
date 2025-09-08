const express = require("express");
const router = express.Router();

/**
 * ✅ List students with device issues
 */
router.get("/students/issues", (req, res) => {
  const db = req.app.get("db");
  const sql = `
    SELECT 
      id, 
      registration_no, 
      name, 
      email, 
      semester, 
      'Device not recognized' AS issue
    FROM students
    WHERE device_locked = 1
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Device issue fetch error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    res.json({ success: true, issues: results });
  });
});

/**
 * ✅ Reset student device
 */
router.post("/students/reset-device", (req, res) => {
  const db = req.app.get("db");
  const { studentId } = req.body;

  if (!studentId) {
    return res.json({ success: false, message: "Student ID required" });
  }

  // ✅ Clear device_id and unlock account
  const sql =
    "UPDATE students SET device_id = NULL, device_locked = 0, is_active = 1 WHERE id = ?";

  db.query(sql, [studentId], (err, result) => {
    if (err) {
      console.error("❌ Device reset error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.json({
      success: true,
      message: "Device reset successful. Student can log in again.",
    });
  });
});

module.exports = router;
