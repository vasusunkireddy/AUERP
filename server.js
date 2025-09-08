require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();

// ---------------------------
// Middleware
// ---------------------------
app.use(cors());
app.use(express.json());

// ✅ Serve static frontend files from /public
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// MySQL connection config
// ---------------------------
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
};

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  } else {
    console.log("✅ Connected to MySQL database");
  }
});

// Make DB available to all routes
app.set("db", db);

// ---------------------------
// Routes
// ---------------------------

// Dean routes
const deanLoginRoutes = require("./routes/deanlogin.routes");
const deanDepartmentRoutes = require("./routes/deandepartment.routes");
const deanSectionsRoutes = require("./routes/deansections.routes");
const deanFacultyRoutes = require("./routes/deanfaculty.routes");
const deanStudentsRoutes = require("./routes/deanstudents.routes");
const deanCoursesRoutes = require("./routes/deancourses.routes");
const deanTimetableRoutes = require("./routes/deantimetable.routes");
const deanHolidayRoutes = require("./routes/deanholiday.routes");
const deanAttendanceRoutes = require("./routes/deanattendance.routes");

// Faculty routes
const facultyLoginRoutes = require("./routes/facultylogin.routes");
const facultyTimetableRoutes = require("./routes/facultytimetable.routes");
const facultyAttendanceRoutes = require("./routes/facultyattendance.routes");
const facultyProfileRoutes = require("./routes/facultyprofile.routes");

// Student routes
const studentLoginRoutes = require("./routes/studentlogin.routes");
const studentTimetableRoutes = require("./routes/studenttimetable.routes");
const studentAttendanceRoutes = require("./routes/studentattendance.routes");
const studentProfileRoutes = require("./routes/studentprofile.routes"); // ✅ NEW
const profileRoutes = require("./routes/profile.routes");

// IT routes
const itRoutes = require("./routes/it.routes");
const itIssueRoutes = require("./routes/itissue.routes");

// ---------------------------
// Mount APIs
// ---------------------------

// Dean APIs
app.use("/api/dean", deanLoginRoutes);
app.use("/api/dean/departments", deanDepartmentRoutes);
app.use("/api/dean", deanSectionsRoutes);
app.use("/api/dean", deanFacultyRoutes);
app.use("/api/dean", deanStudentsRoutes);
app.use("/api/dean", deanCoursesRoutes);
app.use("/api/dean", deanTimetableRoutes);
app.use("/api/dean", deanHolidayRoutes);
app.use("/api/dean", deanAttendanceRoutes);

// Faculty APIs
app.use("/api/faculty", facultyLoginRoutes);
app.use("/api/faculty", facultyTimetableRoutes);
app.use("/api/faculty", facultyAttendanceRoutes);
app.use("/api/faculty", facultyProfileRoutes);

// Student APIs
app.use("/api/student", studentLoginRoutes);
app.use("/api/student", studentTimetableRoutes);
app.use("/api/student", studentAttendanceRoutes);
app.use("/api/student", studentProfileRoutes); // ✅ mounted profile
app.use("/api/student", profileRoutes);

// IT APIs
app.use("/api/it", itRoutes);
app.use("/api/it", itIssueRoutes);

// ---------------------------
// Frontend Shortcuts
// ---------------------------

// Faculty pages
app.get("/faculty/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "faculty", "login.html"));
});
app.get("/faculty/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "faculty", "dashboard.html"));
});
app.get("/faculty/timetable", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "faculty", "timetable.html"));
});
app.get("/faculty/attendance", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "faculty", "attendance.html"));
});

// Dean pages
app.get("/dean/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// IT pages
app.get("/it/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "it", "login.html"));
});
app.get("/it/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "it", "dashboard.html"));
});
app.get("/it/issues", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "it", "issues.html"));
});

// ---------------------------
// Default route
// ---------------------------
app.get("/", (req, res) => {
  res.send("Alliance Attendance Backend is running 🚀");
});

// ---------------------------
// Start Server
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
