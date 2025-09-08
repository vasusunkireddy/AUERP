const express = require("express");
const router = express.Router();

/**
 * 🔹 Get student profile (basic info + photo)
 */
router.get("/:studentId/profile", (req, res) => {
  const db = req.app.get("db");
  const { studentId } = req.params;

  const sql = `
    SELECT s.id, s.name, s.email, s.alt_email, s.mobile, s.dob,
           s.registration_no,
           -- ✅ Use photo if present, else scanned_photo
           COALESCE(s.photo, s.scanned_photo) AS photo,
           d.name AS department_name, d.code AS department_code,
           b.start_year, b.end_year,
           sec.name AS section_name,
           s.semester, s.is_active
    FROM students s
    LEFT JOIN department d ON s.department_id = d.id
    LEFT JOIN batch b ON s.batch_id = b.id
    LEFT JOIN section sec ON s.section_id = sec.id
    WHERE s.id = ?
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching student profile:", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    const student = results[0];

    // If scanned_photo is relative (uploads/...), fix URL
    if (student.photo && student.photo.startsWith("uploads/")) {
      student.photo = `${req.protocol}://${req.get("host")}/${student.photo}`;
    }

    res.json(student);
  });
});

/**
 * 🔹 Get student timetable (classes)
 */
router.get("/:studentId/timetable", (req, res) => {
  const db = req.app.get("db");
  const { studentId } = req.params;

  const sql = `
    SELECT tt.id, c.code, c.name AS course_name, f.name AS faculty_name, 
           ts.day, ts.start_time, ts.end_time, tt.room
    FROM timetable tt
    JOIN course c ON tt.course_id = c.id
    JOIN faculty f ON tt.faculty_id = f.id
    JOIN timeslot ts ON tt.timeslot_id = ts.id
    JOIN students s ON s.section_id = tt.section_id
    WHERE s.id = ?
    ORDER BY ts.day, ts.start_time
  `;

  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching timetable:", err);
      return res.status(500).json({ message: "DB error" });
    }

    const events = results.map(row => ({
      id: `class-${row.id}`,
      title: `${row.code} - ${row.course_name}`,
      startTime: row.start_time,
      endTime: row.end_time,
      daysOfWeek: [mapDay(row.day)], // Mon → 1, Tue → 2, etc.
      extendedProps: {
        faculty: row.faculty_name,
        room: row.room
      },
      backgroundColor: "#2563eb",
      borderColor: "#2563eb",
      textColor: "white"
    }));

    res.json(events);
  });
});

/**
 * 🔹 Get holidays
 */
router.get("/holidays", (req, res) => {
  const db = req.app.get("db");

  const sql = `SELECT id, date, reason FROM holiday ORDER BY date`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching holidays:", err);
      return res.status(500).json({ message: "DB error" });
    }

    const holidays = results.map(h => ({
      id: `holiday-${h.id}`,
      title: `🎉 Holiday: ${h.reason}`,
      start: h.date,
      allDay: true,
      classNames: ["holiday-event"], // frontend will style red
    }));

    res.json(holidays);
  });
});

/**
 * 🔹 Helper: Convert day (Mon, Tue, ...) to FullCalendar format
 */
function mapDay(day) {
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return map[day] ?? 0;
}

module.exports = router;
