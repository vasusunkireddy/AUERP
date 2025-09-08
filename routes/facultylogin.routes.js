const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const SECRET = process.env.FACULTY_SECRET || "FACULTY_SECRET_KEY";

// Faculty Login
router.post("/login", async (req, res) => {
  try {
    const db = req.app.get("db");
    const { user_id, password } = req.body;

    if (!user_id || !password) {
      return res.status(400).json({ message: "Missing user_id or password" });
    }

    // Query faculty by user_id
    const [rows] = await db
      .promise()
      .query("SELECT * FROM faculty WHERE user_id = ?", [user_id]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const faculty = rows[0];

    if (!faculty.password) {
      return res.status(500).json({ message: "Faculty record has no password field" });
    }

    // Ensure password is a string before compare
    const hashedPassword = faculty.password.toString();

    const isMatch = await bcrypt.compare(password, hashedPassword);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: faculty.id,
        name: faculty.name,
        departmentId: faculty.department_id,
      },
      SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      message: "✅ Login successful",
      token,
      facultyId: faculty.id,
      facultyName: faculty.name,
      departmentId: faculty.department_id,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
