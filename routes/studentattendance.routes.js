const express = require("express");
const router = express.Router();

/**
 * 🔹 Get detailed student attendance
 */
router.get("/:studentId/attendance", (req, res) => {
  const db = req.app.get("db");
  const { studentId } = req.params;

  const sql = `
    SELECT a.date, a.session_id AS session, a.status,
           c.code, c.name AS course_name
    FROM attendance a
    JOIN course c ON a.course_id = c.id
    WHERE a.student_id = ?
    ORDER BY a.date DESC, a.session_id ASC
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching attendance:", err);
      return res.status(500).json({ message: "DB error" });
    }

    const formatted = results.map(r => ({
      date: r.date,
      course: `${r.code} - ${r.course_name}`,
      session: r.session, // ✅ now consistent with frontend
      status: r.status
    }));

    res.json(formatted);
  });
});

/**
 * 🔹 Get student attendance summary
 */
router.get("/:studentId/attendance/summary", (req, res) => {
  const db = req.app.get("db");
  const { studentId } = req.params;

  const sql = `
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status='Present' THEN 1 ELSE 0 END) AS present,
           SUM(CASE WHEN status='Absent' THEN 1 ELSE 0 END) AS absent
    FROM attendance
    WHERE student_id = ?
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching summary:", err);
      return res.status(500).json({ message: "DB error" });
    }

    const total = results[0].total || 0;
    const present = results[0].present || 0;
    const absent = results[0].absent || 0;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({
      totalSessions: total,
      present,
      absent,
      percentage
    });
  });
});

module.exports = router;
