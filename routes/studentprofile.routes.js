const express = require("express");
const router = express.Router();

/**
 * 🔹 Get full student profile + today's timetable
 * Uses ONLY Cloudinary URL stored in `students.photo`
 */
router.get("/:id/profile", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  // Weekday names
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = days[new Date().getDay()];

  // ✅ Profile query (only photo column)
  const profileSql = `
    SELECT 
      s.id,
      s.registration_no,
      s.name,
      s.email,
      s.photo,                -- Cloudinary photo only
      s.semester,
      s.is_active,
      s.section_id,
      s.dob,
      s.mobile,
      s.alt_email,
      s.aadhar,
      s.address,
      d.name AS department_name,
      d.code AS department_code,
      b.start_year,
      b.end_year,
      sec.name AS section_name
    FROM students s
    JOIN department d ON d.id = s.department_id
    JOIN batch b ON b.id = s.batch_id
    JOIN section sec ON sec.id = s.section_id
    WHERE s.id = ?
  `;

  db.query(profileSql, [id], (err, profileResult) => {
    if (err) {
      console.error("❌ DB error (profile):", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    if (profileResult.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const profile = profileResult[0];

    // ✅ Ensure photo always has a usable URL
    if (!profile.photo) {
      profile.photo = "https://res.cloudinary.com/do9cbfu5l/image/upload/v1690000000/default-avatar.png";
    }

    // ✅ Timetable query
    const timetableSql = `
      SELECT 
        ts.start_time,
        ts.end_time,
        c.code AS course_code,
        c.name AS course,
        f.name AS faculty,
        tt.room
      FROM timetable tt
      JOIN course c ON c.id = tt.course_id
      JOIN faculty f ON f.id = tt.faculty_id
      JOIN timeslot ts ON ts.id = tt.timeslot_id
      WHERE tt.section_id = ?
        AND ts.day = ?
      ORDER BY ts.start_time
    `;

    db.query(timetableSql, [profile.section_id, today], (err, timetableResult) => {
      if (err) {
        console.error("❌ DB error (timetable):", err);
        return res.status(500).json({ error: "Database error", details: err.message });
      }

      res.json({
        ...profile,
        today_timetable: timetableResult || []
      });
    });
  });
});

module.exports = router;
