const express = require("express");
const router = express.Router();

/**
 * 🔹 Get summary of attendance (per student in a section)
 * ✅ Keep this BEFORE the section+date route
 */
router.get("/attendance/summary/:sectionId", (req, res) => {
  const db = req.app.get("db");
  const { sectionId } = req.params;

  const sql = `
    SELECT 
      st.id AS student_id, st.registration_no, st.name AS student_name,
      COUNT(*) AS total_classes,
      SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END) AS absent_count
    FROM attendance a
    JOIN students st ON a.student_id = st.id
    WHERE st.section_id = ?
    GROUP BY st.id, st.registration_no, st.name
    ORDER BY st.registration_no
  `;

  db.query(sql, [sectionId], (err, results) => {
    if (err) {
      console.error("❌ DB error (summary)", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(results || []);
  });
});

/**
 * 🔹 Get attendance by section & date
 */
router.get("/attendance/:sectionId/:date", (req, res) => {
  const db = req.app.get("db");
  const { sectionId, date } = req.params;

  const sql = `
    SELECT 
      a.id, a.date, a.status, a.method,
      st.id AS student_id, st.registration_no, st.name AS student_name,
      c.id AS course_id, c.code AS course_code, c.name AS course_name,
      f.id AS faculty_id, f.name AS faculty_name,
      s.name AS section_name, s.semester
    FROM attendance a
    JOIN students st ON a.student_id = st.id
    JOIN course c ON a.course_id = c.id
    JOIN faculty f ON a.faculty_id = f.id
    JOIN section s ON st.section_id = s.id
    WHERE st.section_id = ? AND a.date = ?
    ORDER BY st.registration_no
  `;

  db.query(sql, [sectionId, date], (err, results) => {
    if (err) {
      console.error("❌ DB error (attendance by date)", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(results || []);
  });
});

/**
 * 🔹 Update a student's attendance status
 */
router.put("/attendance/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["Present", "Absent"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const sql = "UPDATE attendance SET status=? WHERE id=?";
  db.query(sql, [status, id], (err, result) => {
    if (err) {
      console.error("❌ DB error (update)", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Attendance record not found" });
    }
    res.json({ message: "✅ Attendance updated successfully" });
  });
});

module.exports = router;
