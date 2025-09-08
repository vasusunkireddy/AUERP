const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "au-erp/profile_photos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 300, height: 300, crop: "fill" }],
  },
});
const upload = multer({ storage });

// Get profile
router.get("/:id/profile", (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;

  const sql = `
    SELECT s.id, s.registration_no, s.name, s.email, s.photo, s.semester,
           s.dob, s.mobile, s.alt_email, s.aadhar, s.address,
           d.name AS department_name, sec.name AS section_name
    FROM students s
    JOIN department d ON d.id = s.department_id
    JOIN section sec ON sec.id = s.section_id
    WHERE s.id = ?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    if (result.length === 0) return res.status(404).json({ error: "Student not found" });
    res.json(result[0]);
  });
});

// Update profile
router.put("/:id/profile", upload.single("photo"), (req, res) => {
  const db = req.app.get("db");
  const { id } = req.params;
  const { dob, mobile, alt_email, aadhar, address } = req.body;

  let photo = null;
  if (req.file && req.file.path) photo = req.file.path;

  const fields = [];
  const values = [];

  if (dob) { fields.push("dob = ?"); values.push(dob); }
  if (mobile) { fields.push("mobile = ?"); values.push(mobile); }
  if (alt_email) { fields.push("alt_email = ?"); values.push(alt_email); }
  if (aadhar) { fields.push("aadhar = ?"); values.push(aadhar); }
  if (address) { fields.push("address = ?"); values.push(address); }
  if (photo) { fields.push("photo = ?"); values.push(photo); }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const sql = `UPDATE students SET ${fields.join(", ")} WHERE id = ?`;
  values.push(id);

  db.query(sql, values, (err) => {
    if (err) {
      console.error("Error updating profile:", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    res.json({ message: "Profile updated successfully" });
  });
});

module.exports = router;
