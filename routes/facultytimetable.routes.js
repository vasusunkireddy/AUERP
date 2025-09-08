const express = require("express");
const router = express.Router();

/**
 * 🔹 Get timetable for a faculty (with holidays)
 */
router.get("/timetable/:facultyId", (req, res) => {
  const db = req.app.get("db");
  const { facultyId } = req.params;

  const timetableSql = `
    SELECT 
      tt.id, tt.room, tt.duration_periods,
      ts.id AS timeslot_id, ts.day, ts.session, ts.start_time, ts.end_time,
      c.id AS course_id, c.code AS course_code, c.name AS course_name,
      f.id AS faculty_id, f.name AS faculty_name,
      s.id AS section_id, s.name AS section_name, s.semester,
      b.start_year, b.end_year,
      CONCAT(b.start_year, '-', b.end_year) AS batch_name,
      d.name AS department_name,
      p.name AS program_name
    FROM timetable tt
    JOIN course c ON tt.course_id = c.id
    JOIN faculty f ON tt.faculty_id = f.id
    JOIN timeslot ts ON tt.timeslot_id = ts.id
    JOIN section s ON tt.section_id = s.id
    JOIN department d ON s.department_id = d.id
    JOIN program p ON d.program_id = p.id
    JOIN batch b ON s.batch_id = b.id
    WHERE tt.faculty_id = ?
    ORDER BY FIELD(ts.day,'Mon','Tue','Wed','Thu','Fri','Sat'), ts.session
  `;

  db.query(timetableSql, [facultyId], (err, timetableResults) => {
    if (err) {
      console.error("❌ DB error (faculty timetable)", err);
      return res.status(500).json({ message: "DB error" });
    }

    // 🔹 Fetch holidays too
    const holidaySql = `SELECT id, date, reason FROM holiday ORDER BY date`;

    db.query(holidaySql, (hErr, holidayResults) => {
      if (hErr) {
        console.error("❌ DB error (holiday)", hErr);
        return res.status(500).json({ message: "DB error" });
      }

      res.json({ 
        timetable: timetableResults || [], 
        holidays: holidayResults || [] 
      });
    });
  });
});

module.exports = router;
