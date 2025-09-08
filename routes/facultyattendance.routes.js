// routes/facultyattendance.routes.js
const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");
const crypto = require("crypto");

/**
 * Faculty Attendance API routes
 *
 * Required mounted path: app.use("/api/faculty", require("./routes/facultyattendance.routes"));
 *
 * Endpoints:
 * - GET  /:facultyId/sessions?date=YYYY-MM-DD
 * - GET  /:facultyId/attendance-status?sessionId=&courseId=&date=
 * - GET  /:facultyId/students?sessionId=&courseId=&date=
 * - GET  /:facultyId/generate-qr?sessionId=&courseId=&date=
 * - POST /scan-face
 * - POST /attendance
 */

function handleDbError(res, tag, err) {
  console.error(tag, err && err.sqlMessage ? err.sqlMessage : err);
  return res.status(500).json({ message: "DB error", error: err && err.sqlMessage ? err.sqlMessage : String(err) });
}

/**
 * GET sessions for faculty on date
 */
router.get("/:facultyId/sessions", (req, res) => {
  const db = req.app.get("db");
  const { facultyId } = req.params;
  const { date } = req.query;

  if (!facultyId) return res.status(400).json({ message: "Missing facultyId" });
  if (!date) return res.status(400).json({ message: "Missing date" });

  const sql = `
    SELECT 
      ts.id AS session_id, ts.session, ts.start_time, ts.end_time, ts.day,
      c.id AS course_id, c.code AS course_code, c.name AS course_name,
      s.id AS section_id, s.name AS section_name, s.semester
    FROM timetable tt
    JOIN timeslot ts ON tt.timeslot_id = ts.id
    JOIN course c    ON tt.course_id   = c.id
    JOIN section s   ON tt.section_id  = s.id
    WHERE tt.faculty_id = ?
      AND ts.day = DATE_FORMAT(?, '%a')
    ORDER BY ts.session ASC;
  `;

  db.query(sql, [facultyId, date], (err, rows) => {
    if (err) return handleDbError(res, "sessions", err);
    res.json(rows || []);
  });
});

/**
 * GET attendance-status
 * returns { exists, count, last_mode, last_time, final_count }
 *
 * NOTE: "exists" means final attendance rows exist (not provisional QR rows).
 * Final criteria: COALESCE(finalized,0)=1 OR mode IN ('manual','final')
 */
router.get("/:facultyId/attendance-status", (req, res) => {
  const db = req.app.get("db");
  const { facultyId } = req.params;
  const { sessionId, courseId, date } = req.query;

  if (!facultyId || !sessionId || !courseId || !date) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const sql = `
    SELECT COUNT(*) AS cnt,
           MAX(mode) AS last_mode,
           DATE_FORMAT(MAX(created_at), '%Y-%m-%d %H:%i:%s') AS last_time,
           SUM(CASE WHEN (COALESCE(finalized,0)=1 OR mode IN ('manual','final')) THEN 1 ELSE 0 END) AS final_cnt
    FROM attendance
    WHERE faculty_id = ?
      AND session_id = ?
      AND course_id  = ?
      AND date       = ?;
  `;
  db.query(sql, [facultyId, sessionId, courseId, date], (err, rows) => {
    if (err) return handleDbError(res, "attendance-status", err);
    const row = (rows && rows[0]) || { cnt: 0, last_mode: null, last_time: null, final_cnt: 0 };
    res.json({
      exists: Number(row.final_cnt || 0) > 0,
      count: Number(row.cnt || 0),
      final_count: Number(row.final_cnt || 0),
      last_mode: row.last_mode,
      last_time: row.last_time
    });
  });
});

/**
 * GET students for a session
 * - returns student list for that timetable slot's section
 * - includes latest attendance row for each student for this (session,course,date) (status + scanned_photo)
 *
 * NOTE: returned attendance rows may be provisional (mode='qr') or manual. Frontend uses attendance-status to decide finality.
 */
router.get("/:facultyId/students", (req, res) => {
  const db = req.app.get("db");
  const { facultyId } = req.params;
  const { sessionId, courseId, date } = req.query;

  if (!facultyId || !sessionId || !courseId || !date) {
    return res.status(400).json({ message: "Missing sessionId/courseId/date/facultyId" });
  }

  const sql = `
    SELECT st.id, st.registration_no, st.name, st.photo,
           COALESCE(a.status, 'Absent') AS status,
           a.scanned_photo,
           a.mode AS last_mode,
           a.created_at AS last_attended_at
    FROM timetable tt
    JOIN timeslot ts ON ts.id = tt.timeslot_id
    JOIN students st ON st.section_id = tt.section_id

    LEFT JOIN (
      SELECT aa.student_id, aa.status, aa.scanned_photo, aa.mode, aa.created_at
      FROM attendance aa
      JOIN (
        SELECT student_id, MAX(created_at) AS max_created
        FROM attendance
        WHERE session_id = ? AND course_id = ? AND date = ?
        GROUP BY student_id
      ) lastrow
        ON lastrow.student_id = aa.student_id AND lastrow.max_created = aa.created_at
      WHERE aa.session_id = ? AND aa.course_id = ? AND aa.date = ?
    ) a ON a.student_id = st.id

    WHERE tt.timeslot_id = ?
      AND tt.faculty_id  = ?
      AND tt.course_id   = ?
    ORDER BY st.registration_no ASC, st.id ASC;
  `;

  const params = [
    sessionId, courseId, date,
    sessionId, courseId, date,
    sessionId, facultyId, courseId
  ];

  db.query(sql, params, (err, rows) => {
    if (err) return handleDbError(res, "students", err);
    res.json(rows || []);
  });
});

/**
 * Generate QR (data URL)
 */
router.get("/:facultyId/generate-qr", async (req, res) => {
  const { facultyId } = req.params;
  const { sessionId, courseId, date } = req.query;
  if (!facultyId || !sessionId || !courseId || !date) return res.status(400).json({ message: "Missing fields" });

  const payload = { facultyId, sessionId, courseId, date, ts: Date.now() };
  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload));
    res.json({ qrCode: qrDataUrl, payload });
  } catch (err) {
    console.error("generate-qr", err);
    res.status(500).json({ message: "QR generation failed", error: String(err) });
  }
});

/**
 * Scan-face (proxy prevention) — save face hash on students table
 */
router.post("/scan-face", (req, res) => {
  const db = req.app.get("db");
  const { student_id, scanned_photo } = req.body;
  if (!student_id || !scanned_photo) return res.status(400).json({ message: "Missing student_id or scanned_photo" });

  try {
    const face_hash = crypto.createHash("sha256").update(scanned_photo).digest("hex");
    const checkSql = `SELECT id, name, registration_no FROM students WHERE face_hash = ? AND id != ? LIMIT 1`;
    db.query(checkSql, [face_hash, student_id], (err, rows) => {
      if (err) return handleDbError(res, "scan-face/dup-check", err);
      if (rows && rows.length > 0) {
        const x = rows[0];
        return res.status(400).json({ message: `Proxy detected! Face already belongs to ${x.name} (${x.registration_no})` });
      }
      const upd = `UPDATE students SET face_hash = ? WHERE id = ?`;
      db.query(upd, [face_hash, student_id], (err2) => {
        if (err2) return handleDbError(res, "scan-face/update", err2);
        return res.json({ success: true, message: "Face scanned" });
      });
    });
  } catch (err) { console.error("scan-face", err); res.status(500).json({ message: "Server error" }); }
});

/**
 * POST attendance
 * - Expects payload: { faculty_id, session_id, course_id, date, mode, records: [{student_id,status,scanned_photo}, ...], qr_ts, force }
 *
 * Behavior:
 * - We only block manual submission if FINAL attendance exists (finalized=1 OR mode IN ('manual','final')).
 * - QR scans (mode='qr') will create provisional rows but won't block faculty's manual submit.
 * - If mode === 'manual', attempt to mark finalized = 1 for these rows (ignored if column missing).
 * - force === true will overwrite (used by Modify Attendance).
 */
router.post("/attendance", (req, res) => {
  const db = req.app.get("db");
  const {
    faculty_id, session_id, course_id, date,
    mode = "manual", records, qr_ts, force = false
  } = req.body;

  if (!faculty_id || !session_id || !course_id || !date || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: "Missing fields or records" });
  }

  if (mode === "qr") {
    if (!qr_ts) return res.status(400).json({ success: false, message: "Missing QR timestamp" });
    if (Date.now() - qr_ts > 10000) return res.status(400).json({ success: false, message: "QR Code expired" });
  }

  // Validate timetable ownership
  const valSql = `SELECT 1 FROM timetable tt WHERE tt.faculty_id = ? AND tt.timeslot_id = ? AND tt.course_id = ? LIMIT 1`;
  db.query(valSql, [faculty_id, session_id, course_id], (err, ok) => {
    if (err) return handleDbError(res, "attendance/validate", err);
    if (!ok || ok.length === 0) return res.status(400).json({ success: false, message: "Invalid session for this faculty/course" });

    // Check for FINAL attendance only
    const checkSql = `
      SELECT
        SUM(CASE WHEN (COALESCE(finalized,0)=1 OR mode IN ('manual','final')) THEN 1 ELSE 0 END) AS final_cnt
      FROM attendance
      WHERE faculty_id = ? AND session_id = ? AND course_id = ? AND date = ?;
    `;
    db.query(checkSql, [faculty_id, session_id, course_id, date], (err2, rows2) => {
      if (err2) return handleDbError(res, "attendance/check-exists", err2);
      const finalCnt = (rows2 && rows2[0] && rows2[0].final_cnt) ? Number(rows2[0].final_cnt) : 0;
      if (finalCnt > 0 && !force) {
        // final attendance already recorded — block normal mark screen
        return res.status(409).json({ success: false, message: "Attendance already exists for this session. Use Modify Attendance to change." });
      }

      // Bulk upsert
      const studentIds = records.map(r => r.student_id).filter(Boolean);
      if (!studentIds.length) return res.status(400).json({ success: false, message: "No student ids provided" });

      const photoSql = `SELECT id, scanned_photo FROM students WHERE id IN (?)`;
      db.query(photoSql, [studentIds], (err3, photoRows) => {
        if (err3) return handleDbError(res, "attendance/photo-select", err3);
        const photoMap = {};
        (photoRows || []).forEach(r => { photoMap[r.id] = r.scanned_photo; });

        const values = records.map(r => ([
          faculty_id,
          session_id,
          course_id,
          r.student_id,
          date,
          r.status,
          mode,
          r.scanned_photo || photoMap[r.student_id] || null
        ]));

        const upsert = `
          INSERT INTO attendance
            (faculty_id, session_id, course_id, student_id, date, status, mode, scanned_photo)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            mode = VALUES(mode),
            scanned_photo = VALUES(scanned_photo),
            created_at = NOW()
        `;
        db.query(upsert, [values], (err4) => {
          if (err4) return handleDbError(res, "attendance/upsert", err4);

          // If manual submit, attempt to set finalized = 1 for this session/course/date.
          if (mode === 'manual') {
            const tryFinalSql = `
              UPDATE attendance
              SET finalized = 1
              WHERE faculty_id = ? AND session_id = ? AND course_id = ? AND date = ?;
            `;
            db.query(tryFinalSql, [faculty_id, session_id, course_id, date], (err5) => {
              // ignore errors here (column may not exist). Respond success regardless.
              if (err5) {
                // log but don't fail
                console.warn("finalized update failed (maybe column missing):", err5 && err5.sqlMessage ? err5.sqlMessage : err5);
              }
              return res.json({ success: true, message: "Attendance saved", saved_at: new Date().toISOString() });
            });
          } else {
            // Provisional save (e.g. QR scans or other modes)
            return res.json({ success: true, message: "Attendance saved (provisional)", saved_at: new Date().toISOString() });
          }
        });
      });
    });
  });
});

module.exports = router;
