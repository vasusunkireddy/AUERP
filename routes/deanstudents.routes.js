const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Setup Multer for file upload
const upload = multer({ dest: "uploads/" });

// ==================== CRUD ==================== //

// Get all students
router.get("/students", (req, res) => {
  const db = req.app.get("db");
  const sql = `
    SELECT s.id, s.registration_no, s.name, s.email, s.photo,
           s.department_id, d.name AS department_name,
           s.batch_id, CONCAT(b.start_year,'-',b.end_year) AS batch_name,
           s.section_id, sec.name AS section_name,
           s.semester
    FROM students s
    JOIN department d ON s.department_id = d.id
    JOIN batch b ON s.batch_id = b.id
    JOIN section sec ON s.section_id = sec.id
    ORDER BY s.id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB error", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(results);
  });
});

// Add student
router.post("/students", (req, res) => {
  const db = req.app.get("db");
  const { registration_no, name, email, photo, department_id, batch_id, section_id, semester } = req.body;

  if (!registration_no || !name || !email || !department_id || !batch_id || !section_id || !semester) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  db.query(
    "INSERT INTO students (registration_no, name, email, photo, department_id, batch_id, section_id, semester) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [registration_no, name, email, photo || null, department_id, batch_id, section_id, semester],
    (err, result) => {
      if (err) {
        console.error("DB error", err);
        return res.status(500).json({ message: "DB error" });
      }
      res.json({ id: result.insertId, registration_no, name, email, photo, department_id, batch_id, section_id, semester });
    }
  );
});

// Update student
router.put("/students/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { registration_no, name, email, photo, department_id, batch_id, section_id, semester } = req.body;

  if (!registration_no || !name || !email || !department_id || !batch_id || !section_id || !semester) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  db.query(
    "UPDATE students SET registration_no=?, name=?, email=?, photo=?, department_id=?, batch_id=?, section_id=?, semester=? WHERE id=?",
    [registration_no, name, email, photo || null, department_id, batch_id, section_id, semester, id],
    (err, result) => {
      if (err) {
        console.error("DB error", err);
        return res.status(500).json({ message: "DB error" });
      }
      if (result.affectedRows === 0) return res.status(404).json({ message: "Student not found" });
      res.json({ message: "Student updated successfully" });
    }
  );
});

// Delete student
router.delete("/students/:id", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  db.query("DELETE FROM students WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("DB error", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student deleted successfully" });
  });
});

// ==================== BULK UPLOAD ==================== //

router.post("/students/bulk", upload.single("file"), (req, res) => {
  const db = req.app.get("db");
  const filePath = req.file.path;
  const students = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", row => {
      students.push(row);
    })
    .on("end", () => {
      if (students.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ message: "Empty CSV" });
      }

      const sql = `
        INSERT INTO students (registration_no, name, email, photo, department_id, batch_id, section_id, semester)
        VALUES ?
      `;

      const values = students.map(s => [
        s.registration_no,
        s.name,
        s.email,
        s.photo || null,
        s.department_id,
        s.batch_id,
        s.section_id,
        s.semester
      ]);

      db.query(sql, [values], err => {
        fs.unlinkSync(filePath); // cleanup file
        if (err) {
          console.error("DB error", err);
          return res.status(500).json({ message: "DB error" });
        }
        res.json({ message: "Bulk upload successful", count: students.length });
      });
    });
});

module.exports = router;
