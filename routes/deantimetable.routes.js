const express = require("express");
const router = express.Router();

/**
 * 🔹 Static fallback timeslots (only used if DB doesn't have timeslot rows)
 */
const fallbackTimeslots = [];
(() => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let idCounter = 1;
  const slots = [
    ["08:00","08:55"],["09:00","09:55"],["10:00","10:55"],["11:00","11:55"],
    ["12:00","12:55"],["13:00","13:55"],["14:00","14:55"],["15:00","15:55"],["16:00","16:20"]
  ];
  days.forEach(day => {
    slots.forEach((slot, i) => {
      fallbackTimeslots.push({
        id: idCounter++,
        day,
        session: i + 1,
        start_time: slot[0],
        end_time: slot[1],
      });
    });
  });
})();

/** Helper: build placeholders for IN (...) */
function placeholders(n) {
  return Array(n).fill("?").join(",");
}

/** GET all timeslots (prefer DB; fallback to static) */
router.get("/timeslots", (req, res) => {
  const db = req.app.get("db");
  const sql = `
    SELECT id, day, session, start_time, end_time
    FROM timeslot
    ORDER BY FIELD(day,'Mon','Tue','Wed','Thu','Fri','Sat'), session
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("❌ DB error (/timeslots)", err);
      return res.json(fallbackTimeslots);
    }
    if (!rows || rows.length === 0) return res.json(fallbackTimeslots);
    res.json(rows);
  });
});

/** Get timetable for a section (with holidays) */
router.get("/timetable/:sectionId", (req, res) => {
  const db = req.app.get("db");
  const { sectionId } = req.params;

  const sql = `
    SELECT 
      tt.id, tt.room, tt.duration_periods,
      ts.day, ts.session, ts.start_time, ts.end_time,
      c.id AS course_id, c.code AS course_code, c.name AS course_name, c.type AS course_type,
      f.id AS faculty_id, f.name AS faculty_name,
      s.name AS section_name, s.semester,
      b.start_year, b.end_year,
      CONCAT(b.start_year, '-', b.end_year) AS batch_name,
      d.name AS department_name,
      p.name AS program_name
    FROM timetable tt
    JOIN course c   ON tt.course_id   = c.id
    JOIN faculty f  ON tt.faculty_id  = f.id
    JOIN timeslot ts ON tt.timeslot_id = ts.id
    JOIN section s  ON tt.section_id  = s.id
    JOIN department d ON s.department_id = d.id
    JOIN program p  ON d.program_id   = p.id
    JOIN batch b    ON s.batch_id     = b.id
    WHERE tt.section_id = ?
    ORDER BY FIELD(ts.day,'Mon','Tue','Wed','Thu','Fri','Sat'), ts.session
  `;

  db.query(sql, [sectionId], (err, results) => {
    if (err) {
      console.error("❌ DB error (timetable)", err);
      return res.status(500).json({ message: "DB error" });
    }

    db.query("SELECT id, date, reason FROM holiday ORDER BY date", (hErr, holidays) => {
      if (hErr) {
        console.error("❌ DB error (holiday)", hErr);
        return res.status(500).json({ message: "DB error" });
      }
      res.json({ timetable: results, holidays });
    });
  });
});

/** Add timetable entry (supports Lab=2 consecutive sessions same day) */
router.post("/timetable", (req, res) => {
  const db = req.app.get("db");
  const { section_id, course_id, faculty_id, timeslot_id, room } = req.body;

  if (!section_id || !course_id || !faculty_id || !timeslot_id) {
    return res.status(400).json({ message: "Missing fields" });
  }

  // 1) Fetch course type
  db.query("SELECT type FROM course WHERE id=?", [course_id], (err, cRes) => {
    if (err || cRes.length === 0) {
      return res.status(400).json({ message: "Invalid course" });
    }
    const isLab = (cRes[0].type === "Lab");

    // 2) Get current timeslot details
    db.query("SELECT id, day, session FROM timeslot WHERE id=?", [timeslot_id], (tErr, tRes) => {
      if (tErr || tRes.length === 0) {
        return res.status(400).json({ message: "Invalid timeslot" });
      }
      const ts = tRes[0];

      // 3) If Lab, find next consecutive session on SAME day
      const needConsecutive = isLab;
      const fetchNext = (cb) => {
        if (!needConsecutive) return cb(null, null);
        db.query(
          "SELECT id FROM timeslot WHERE day=? AND session=?",
          [ts.day, ts.session + 1],
          (nErr, nRes) => {
            if (nErr) return cb(nErr);
            if (!nRes || nRes.length === 0) {
              return cb({ code: 400, msg: "Lab requires two consecutive sessions on the same day" });
            }
            cb(null, nRes[0].id);
          }
        );
      };

      fetchNext((nErr, secondSlotId) => {
        if (nErr) {
          const status = nErr.code === 400 ? 400 : 500;
          return res.status(status).json({ message: nErr.msg || "DB error" });
        }

        const slotIds = [Number(timeslot_id)];
        if (secondSlotId) slotIds.push(Number(secondSlotId));

        // 4) Conflict check (section or faculty occupied in any of the required slots)
        const inPh = placeholders(slotIds.length);
        const checkSql = `
          SELECT * FROM timetable 
          WHERE (section_id = ? AND timeslot_id IN (${inPh}))
             OR (faculty_id = ? AND timeslot_id IN (${inPh}))
        `;
        const params = [section_id, ...slotIds, faculty_id, ...slotIds];

        db.query(checkSql, params, (chkErr, rows) => {
          if (chkErr) {
            console.error("❌ DB error (conflict check)", chkErr);
            return res.status(500).json({ message: "DB error" });
          }
          if (rows.length > 0) {
            return res.status(400).json({ message: "❌ Timeslot conflict (section/faculty booked)" });
          }

          // 5) Insert
          const duration = isLab ? 2 : 1;
          const sql = `
            INSERT INTO timetable (section_id, course_id, faculty_id, timeslot_id, room, duration_periods)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          db.query(sql, [section_id, course_id, faculty_id, timeslot_id, room || null, duration], (insErr, result) => {
            if (insErr) {
              console.error("❌ DB error (insert)", insErr);
              return res.status(500).json({ message: "DB error" });
            }
            res.json({ id: result.insertId, message: "✅ Entry added successfully" });
          });
        });
      });
    });
  });
});

/** Update timetable entry (supports Lab=2 consecutive sessions same day) */
router.put("/timetable/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { course_id, faculty_id, timeslot_id, room } = req.body;

  if (!course_id || !faculty_id || !timeslot_id) {
    return res.status(400).json({ message: "Missing fields" });
  }

  // Get the record's section for conflict checks
  db.query("SELECT section_id FROM timetable WHERE id=?", [id], (sErr, sRes) => {
    if (sErr || sRes.length === 0) return res.status(404).json({ message: "Entry not found" });
    const section_id = sRes[0].section_id;

    // Course type
    db.query("SELECT type FROM course WHERE id=?", [course_id], (cErr, cRes) => {
      if (cErr || cRes.length === 0) return res.status(400).json({ message: "Invalid course" });
      const isLab = (cRes[0].type === "Lab");

      // New timeslot details
      db.query("SELECT id, day, session FROM timeslot WHERE id=?", [timeslot_id], (tErr, tRes) => {
        if (tErr || tRes.length === 0) return res.status(400).json({ message: "Invalid timeslot" });
        const ts = tRes[0];

        const fetchNext = (cb) => {
          if (!isLab) return cb(null, null);
          db.query(
            "SELECT id FROM timeslot WHERE day=? AND session=?",
            [ts.day, ts.session + 1],
            (nErr, nRes) => {
              if (nErr) return cb(nErr);
              if (!nRes || nRes.length === 0) {
                return cb({ code: 400, msg: "Lab requires two consecutive sessions on the same day" });
              }
              cb(null, nRes[0].id);
            }
          );
        };

        fetchNext((nErr, secondSlotId) => {
          if (nErr) {
            const status = nErr.code === 400 ? 400 : 500;
            return res.status(status).json({ message: nErr.msg || "DB error" });
          }

          const slotIds = [Number(timeslot_id)];
          if (secondSlotId) slotIds.push(Number(secondSlotId));

          const inPh = placeholders(slotIds.length);
          const checkSql = `
            SELECT * FROM timetable 
            WHERE id <> ?
              AND (
                (section_id = ? AND timeslot_id IN (${inPh}))
                OR (faculty_id = ? AND timeslot_id IN (${inPh}))
              )
          `;
          const params = [id, section_id, ...slotIds, faculty_id, ...slotIds];

          db.query(checkSql, params, (chkErr, rows) => {
            if (chkErr) {
              console.error("❌ DB error (conflict check)", chkErr);
              return res.status(500).json({ message: "DB error" });
            }
            if (rows.length > 0) {
              return res.status(400).json({ message: "❌ Timeslot conflict (section/faculty booked)" });
            }

            const duration = isLab ? 2 : 1;
            const sql = `
              UPDATE timetable
              SET course_id=?, faculty_id=?, timeslot_id=?, room=?, duration_periods=?
              WHERE id=?
            `;
            db.query(sql, [course_id, faculty_id, timeslot_id, room || null, duration, id], (uErr, result) => {
              if (uErr) {
                console.error("❌ DB error (update)", uErr);
                return res.status(500).json({ message: "DB error" });
              }
              if (result.affectedRows === 0) return res.status(404).json({ message: "Entry not found" });
              res.json({ message: "✅ Timetable updated successfully" });
            });
          });
        });
      });
    });
  });
});

/** Delete timetable entry */
router.delete("/timetable/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  if (!id || isNaN(id)) return res.status(400).json({ message: "Invalid timetable id" });

  db.query("DELETE FROM timetable WHERE id=?", [Number(id)], (err, result) => {
    if (err) {
      console.error("❌ DB error (delete)", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Entry not found" });
    res.json({ message: "✅ Timetable entry deleted" });
  });
});

module.exports = router;
