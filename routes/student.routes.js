const express = require("express");
const router = express.Router();

/**
 * 🔹 Get full student profile with department, batch, section, and enrolled courses
 */
router.get("/:id/profile", (req, res) => {
  const db = req.app.get("db"); // MySQL connection from server.js
  const { id } = req.params;

  // Main student query with joins
  const studentSql = `
    SELECT 
      s.id, s.registration_no, s.name, s.email, s.photo, s.scanned_photo,
      s.face_hash, s.semester, s.is_active, s.device_locked, s.device_id,
      d.name AS department_name, b.name AS batch_name, b.start_year, b.end_year,
      sec.name AS section_name
    FROM students s
    JOIN departments d ON d.id = s.department_id
    JOIN batches b ON b.id = s.batch_id
    JOIN sections sec ON sec.id = s.section_id
    WHERE s.id = ?
  `;

  // Courses query
  const coursesSql = `
    SELECT c.code, c.title, c.credits, ce.semester, sec.name AS section
    FROM course_enrollments ce
    JOIN courses c ON c.id = ce.course_id
    JOIN sections sec ON sec.id = ce.section_id
    WHERE ce.student_id = ?
    ORDER BY ce.semester, c.code
  `;

  db.query(studentSql, [id], (err, studentResult) => {
    if (err) {
      console.error("DB error (student):", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (studentResult.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const student = studentResult[0];

    db.query(coursesSql, [id], (err2, coursesResult) => {
      if (err2) {
        console.error("DB error (courses):", err2);
        return res.status(500).json({ error: "Database error" });
      }

      student.courses = coursesResult;
      res.json(student);
    });
  });
});

module.exports = router;
