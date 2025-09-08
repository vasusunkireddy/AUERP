const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Student login
router.post("/login", (req, res) => {
  const db = req.app.get("db");
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing email or password" });
  }

  // ✅ Only allow @ced.alliance.edu.in emails
  if (!email.endsWith("@ced.alliance.edu.in")) {
    return res.status(400).json({ message: "Only CED Alliance emails are allowed" });
  }

  const sql = `SELECT id, name, email, section_id, password FROM students WHERE email = ? LIMIT 1`;

  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("❌ DB error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (results.length === 0) {
      return res.status(400).json({ message: "No student found with this email" });
    }

    const student = results[0];

    try {
      const passwordMatch = await bcrypt.compare(password, student.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid password" });
      }

      // ✅ Create JWT token
      const token = jwt.sign(
        { studentId: student.id, email: student.email },
        "secretKey", // ⚠️ use process.env.JWT_SECRET in production
        { expiresIn: "1h" }
      );

      res.json({
        message: "✅ Login successful",
        token,
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        sectionId: student.section_id
      });
    } catch (err2) {
      console.error("❌ Password check error:", err2);
      return res.status(500).json({ message: "Error validating password" });
    }
  });
});

module.exports = router;
