
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool, testDatabaseConnection } from "./db.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from .env");
}

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "1mb" }));

// ---------- Helpers ----------

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

function createToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function handleDatabaseError(error, res) {
  console.error("Database operation failed:", error.message);

  if (error.code === "23505") {
    return res.status(409).json({
      status: "error",
      message: "Email or employee code already exists.",
    });
  }

  return res.status(500).json({
    status: "error",
    message: "Internal server error.",
  });
}

// ---------- Authentication Middleware ----------

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Authentication token is required.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `SELECT id, full_name, email, role, is_active,
              must_change_password
       FROM users
       WHERE id = $1`,
      [decoded.sub]
    );

    const user = result.rows[0];

    if (!user || !user.is_active || user.role !== decoded.role) {
      return res.status(401).json({
        status: "error",
        message: "Account is inactive or token is invalid.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired token.",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      status: "error",
      message: "Authentication check failed.",
    });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission for this action.",
      });
    }

    next();
  };
}

// ---------- Health Check ----------

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );

    res.json({
      status: "success",
      message: "HCM Lite backend is running",
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    res.status(503).json({
      status: "error",
      message: "Database connection failed.",
    });
  }
});

// ---------- First-Time Admin Setup ----------
// Can create an Admin ONLY while the users table is empty.
// After the first Admin exists, this endpoint is permanently closed.

app.post("/api/setup/admin", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (
    typeof fullName !== "string" ||
    !fullName.trim() ||
    !isValidEmail(email) ||
    !isValidPassword(password)
  ) {
    return res.status(400).json({
      status: "error",
      message: "Provide fullName, a valid email and a password of at least 8 characters.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Prevent two simultaneous first-admin requests.
    await client.query("SELECT pg_advisory_xact_lock(718204)");

    const existing = await client.query(
      "SELECT id FROM users LIMIT 1"
    );

    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        status: "error",
        message: "Initial Admin setup has already been completed.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await client.query(
      `INSERT INTO users
        (full_name, email, password_hash, role,
         is_active, must_change_password)
       VALUES ($1, LOWER($2), $3, 'admin', TRUE, FALSE)
       RETURNING id, full_name, email, role`,
      [fullName.trim(), email.trim(), passwordHash]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      status: "success",
      message: "Initial Admin created. Please log in.",
      user: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return handleDatabaseError(error, res);
  } finally {
    client.release();
  }
});

// ---------- Login ----------

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (
    !isValidEmail(email) ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      status: "error",
      message: "Valid email and password are required.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role,
              is_active, must_change_password
       FROM users
       WHERE email = LOWER($1)`,
      [email.trim()]
    );

    const user = result.rows[0];

    if (
      !user ||
      !user.is_active ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    const token = createToken(user);

    return res.json({
      status: "success",
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password,
      },
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

// ---------- Current User ----------

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({
    status: "success",
    user: {
      id: req.user.id,
      fullName: req.user.full_name,
      email: req.user.email,
      role: req.user.role,
      mustChangePassword: req.user.must_change_password,
    },
  });
});

// ---------- Admin Creates HR Account ----------

app.post(
  "/api/admin/hr",
  authenticate,
  allowRoles("admin"),
  async (req, res) => {
    const { fullName, email, password } = req.body;

    if (
      typeof fullName !== "string" ||
      !fullName.trim() ||
      !isValidEmail(email) ||
      !isValidPassword(password)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Provide fullName, a valid email and a password of at least 8 characters.",
      });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);

      const result = await pool.query(
        `INSERT INTO users
          (full_name, email, password_hash, role,
           is_active, must_change_password)
         VALUES ($1, LOWER($2), $3, 'hr', TRUE, TRUE)
         RETURNING id, full_name, email, role, must_change_password`,
        [fullName.trim(), email.trim(), passwordHash]
      );

      return res.status(201).json({
        status: "success",
        message: "HR account created.",
        user: result.rows[0],
      });
    } catch (error) {
      return handleDatabaseError(error, res);
    }
  }
);

// ---------- Admin / HR Creates Employee ----------

app.post(
  "/api/employees",
  authenticate,
  allowRoles("admin", "hr"),
  async (req, res) => {
    const {
      fullName,
      email,
      password,
      employeeCode,
      phone,
      department,
      designation,
      shiftType,
      joiningDate,
      basicSalary,
      overtimeRate,
    } = req.body;

    if (
      typeof fullName !== "string" ||
      !fullName.trim() ||
      !isValidEmail(email) ||
      !isValidPassword(password) ||
      typeof employeeCode !== "string" ||
      !employeeCode.trim()
    ) {
      return res.status(400).json({
        status: "error",
        message: "fullName, valid email, password (minimum 8 characters) and employeeCode are required.",
      });
    }

    if (
      shiftType != null &&
      !["day", "night"].includes(shiftType)
    ) {
      return res.status(400).json({
        status: "error",
        message: "shiftType must be day or night.",
      });
    }

    const salary = basicSalary == null ? 0 : Number(basicSalary);
    const overtime = overtimeRate == null ? 0 : Number(overtimeRate);

    if (
      !Number.isFinite(salary) ||
      salary < 0 ||
      !Number.isFinite(overtime) ||
      overtime < 0
    ) {
      return res.status(400).json({
        status: "error",
        message: "Salary and overtime rate must be valid non-negative numbers.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const passwordHash = await bcrypt.hash(password, 12);

      const userResult = await client.query(
        `INSERT INTO users
          (full_name, email, password_hash, role,
           is_active, must_change_password)
         VALUES ($1, LOWER($2), $3, 'employee', TRUE, TRUE)
         RETURNING id, full_name, email, role`,
        [fullName.trim(), email.trim(), passwordHash]
      );

      const user = userResult.rows[0];

      const employeeResult = await client.query(
        `INSERT INTO employees
          (user_id, employee_code, full_name, email, phone,
           department, designation, shift_type, joining_date,
           basic_salary, overtime_rate)
         VALUES (
           $1, $2, $3, LOWER($4), $5, $6, $7, $8,
           COALESCE($9::date, CURRENT_DATE), $10, $11
         )
         RETURNING id, user_id, employee_code, full_name,
                   email, department, designation, shift_type,
                   joining_date, basic_salary, overtime_rate`,
        [
          user.id,
          employeeCode.trim(),
          fullName.trim(),
          email.trim(),
          phone || null,
          department || null,
          designation || null,
          shiftType || null,
          joiningDate || null,
          salary,
          overtime,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        status: "success",
        message: "Employee account and profile created.",
        employee: employeeResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return handleDatabaseError(error, res);
    } finally {
      client.release();
    }
  }
);

// ---------- Employee List ----------
// Admin and HR can list employees.
// Employees can see only their own record.

app.get("/api/employees", authenticate, async (req, res) => {
  try {
    let result;

    if (["admin", "hr"].includes(req.user.role)) {
      result = await pool.query(
        `SELECT id, user_id, employee_code, full_name, email,
                phone, department, designation, shift_type,
                joining_date, basic_salary, overtime_rate, is_active
         FROM employees
         ORDER BY id DESC`
      );
    } else {
      result = await pool.query(
        `SELECT id, user_id, employee_code, full_name, email,
                phone, department, designation, shift_type,
                joining_date, basic_salary, overtime_rate, is_active
         FROM employees
         WHERE user_id = $1`,
        [req.user.id]
      );
    }

    return res.json({
      status: "success",
      employees: result.rows,
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});



 // ---------- Attendance Routes ----------

app.get("/api/attendance", authenticate, async (req, res) => {
  try {
    const date = req.query.date;
    const isStaff = ["admin", "hr"].includes(req.user.role);

    let query = `
      SELECT
        a.id,
        a.employee_id,
        a.attendance_date,
        a.check_in,
        a.check_out,
        a.total_work_minutes,
        a.overtime_minutes,
        a.status,
        a.notes,
        e.employee_code,
        e.full_name AS employee_name,
        e.department,
        e.designation
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
    `;

    const values = [];
    const conditions = [];

    if (!isStaff) {
      conditions.push(`e.user_id = $${values.length + 1}`);
      values.push(req.user.id);
    }

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          status: "error",
          message: "Date must be in YYYY-MM-DD format.",
        });
      }

      conditions.push(
        `a.attendance_date = $${values.length + 1}::date`
      );
      values.push(date);
    }

    if (conditions.length) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY a.attendance_date DESC, e.full_name ASC";

    const result = await pool.query(query, values);

    return res.json({
      status: "success",
      attendance: result.rows,
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

app.post(
  "/api/attendance",
  authenticate,
  allowRoles("admin", "hr"),
  async (req, res) => {
    const {
      employeeId,
      date,
      checkIn,
      checkOut,
      status,
      notes,
    } = req.body;

    const allowedStatuses = [
      "present",
      "absent",
      "late",
      "half_day",
      "leave",
    ];

    if (
      !employeeId ||
      !Number.isInteger(Number(employeeId)) ||
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Valid employee, date and attendance status are required.",
      });
    }

    const isAbsentOrLeave = ["absent", "leave"].includes(status);

    if (!isAbsentOrLeave && (!checkIn || !checkOut)) {
      return res.status(400).json({
        status: "error",
        message: "Check-in and check-out are required for this status.",
      });
    }

    try {
      const employeeResult = await pool.query(
        `SELECT id
         FROM employees
         WHERE id = $1 AND is_active = TRUE`,
        [Number(employeeId)]
      );

      if (!employeeResult.rowCount) {
        return res.status(404).json({
          status: "error",
          message: "Active employee not found.",
        });
      }

      let totalWorkMinutes = 0;
      let overtimeMinutes = 0;
      let checkInValue = null;
      let checkOutValue = null;

      if (!isAbsentOrLeave) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);

        if (
          Number.isNaN(start.getTime()) ||
          Number.isNaN(end.getTime()) ||
          end <= start
        ) {
          return res.status(400).json({
            status: "error",
            message: "Check-out must be later than check-in.",
          });
        }

        checkInValue = start.toISOString();
        checkOutValue = end.toISOString();

        const settingsResult = await pool.query(
          `SELECT standard_work_hours, lunch_break_minutes
           FROM company_settings
           ORDER BY id
           LIMIT 1`
        );

        const settings = settingsResult.rows[0];
        const standardHours = Number(settings?.standard_work_hours ?? 8);
        const breakMinutes = Number(settings?.lunch_break_minutes ?? 0);

        const elapsedMinutes = Math.floor(
          (end.getTime() - start.getTime()) / 60000
        );

        totalWorkMinutes = Math.max(0, elapsedMinutes - breakMinutes);

        overtimeMinutes = Math.max(
          0,
          totalWorkMinutes - Math.round(standardHours * 60)
        );
      }

      const result = await pool.query(
        `INSERT INTO attendance (
           employee_id,
           attendance_date,
           check_in,
           check_out,
           total_work_minutes,
           overtime_minutes,
           status,
           notes
         )
         VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (employee_id, attendance_date)
         DO UPDATE SET
           check_in = EXCLUDED.check_in,
           check_out = EXCLUDED.check_out,
           total_work_minutes = EXCLUDED.total_work_minutes,
           overtime_minutes = EXCLUDED.overtime_minutes,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING *`,
        [
          Number(employeeId),
          date,
          checkInValue,
          checkOutValue,
          totalWorkMinutes,
          overtimeMinutes,
          status,
          notes || null,
        ]
      );

      return res.status(201).json({
        status: "success",
        message: "Attendance saved successfully.",
        attendance: result.rows[0],
      });
    } catch (error) {
      return handleDatabaseError(error, res);
    }
  }
);



 // ---------- Company Settings Routes ----------

// Read company settings for any authenticated user.
app.get("/api/settings", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, company_name, office_start_time, grace_minutes,
              standard_work_hours, lunch_break_minutes, weekend_days
       FROM company_settings
       ORDER BY id
       LIMIT 1`
    );

    const row = result.rows[0];

    const settings = row
      ? {
          company_name: row.company_name || "",
          office_start_time: String(row.office_start_time || "09:00").slice(0, 5),
          grace_minutes: Number(row.grace_minutes ?? 15),
          standard_work_hours: Number(row.standard_work_hours ?? 8),
          lunch_break_minutes: Number(row.lunch_break_minutes ?? 60),
          weekend_days: (row.weekend_days || [0]).map(Number),
        }
      : {
          company_name: "",
          office_start_time: "09:00",
          grace_minutes: 15,
          standard_work_hours: 8,
          lunch_break_minutes: 60,
          weekend_days: [0],
        };

    return res.json({
      status: "success",
      settings,
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});


// Update company settings. Admin access only.
app.put(
  "/api/settings",
  authenticate,
  allowRoles("admin"),
  async (req, res) => {
    const {
      company_name,
      office_start_time,
      grace_minutes,
      standard_work_hours,
      lunch_break_minutes,
      weekend_days,
    } = req.body;

    const grace = Number(grace_minutes);
    const workHours = Number(standard_work_hours);
    const lunch = Number(lunch_break_minutes);

    const validTime =
      typeof office_start_time === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(office_start_time);

    const validWeekends =
      Array.isArray(weekend_days) &&
      weekend_days.every(
        (day) =>
          Number.isInteger(Number(day)) &&
          Number(day) >= 0 &&
          Number(day) <= 6
      ) &&
      new Set(weekend_days.map(Number)).size === weekend_days.length;

    if (
      typeof company_name !== "string" ||
      company_name.trim().length > 150 ||
      !validTime ||
      !Number.isFinite(grace) ||
      !Number.isInteger(grace) ||
      grace < 0 ||
      grace > 240 ||
      !Number.isFinite(workHours) ||
      workHours <= 0 ||
      workHours > 24 ||
      !Number.isFinite(lunch) ||
      !Number.isInteger(lunch) ||
      lunch < 0 ||
      lunch > 1440 ||
      !validWeekends
    ) {
      return res.status(400).json({
        status: "error",
        message: "Please provide valid company settings.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT id
         FROM company_settings
         ORDER BY id
         LIMIT 1
         FOR UPDATE`
      );

      let result;

      if (existing.rowCount > 0) {
        result = await client.query(
          `UPDATE company_settings
           SET company_name = $1,
               office_start_time = $2::time,
               grace_minutes = $3,
               standard_work_hours = $4,
               lunch_break_minutes = $5,
               weekend_days = $6,
               updated_at = NOW()
           WHERE id = $7
           RETURNING id, company_name, office_start_time,
                     grace_minutes, standard_work_hours,
                     lunch_break_minutes, weekend_days`,
          [
            company_name.trim(),
            office_start_time,
            grace,
            workHours,
            lunch,
            weekend_days.map(Number),
            existing.rows[0].id,
          ]
        );
      } else {
        result = await client.query(
          `INSERT INTO company_settings (
             company_name,
             office_start_time,
             grace_minutes,
             standard_work_hours,
             lunch_break_minutes,
             weekend_days
           )
           VALUES ($1, $2::time, $3, $4, $5, $6)
           RETURNING id, company_name, office_start_time,
                     grace_minutes, standard_work_hours,
                     lunch_break_minutes, weekend_days`,
          [
            company_name.trim(),
            office_start_time,
            grace,
            workHours,
            lunch,
            weekend_days.map(Number),
          ]
        );
      }

      await client.query("COMMIT");

      const row = result.rows[0];

      return res.json({
        status: "success",
        message: "Company settings saved successfully.",
        settings: {
          company_name: row.company_name || "",
          office_start_time: String(row.office_start_time).slice(0, 5),
          grace_minutes: Number(row.grace_minutes),
          standard_work_hours: Number(row.standard_work_hours),
          lunch_break_minutes: Number(row.lunch_break_minutes),
          weekend_days: (row.weekend_days || []).map(Number),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return handleDatabaseError(error, res);
    } finally {
      client.release();
    }
  }
);


// ---------- Not Found ----------

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "API route not found.",
  });
});

// ---------- Error Handler ----------

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    status: "error",
    message: "Internal server error.",
  });
});

// ---------- Start Server ----------

async function startServer() {
  try {
    await testDatabaseConnection();

    app.listen(PORT, () => {
      console.log(`HCM Lite backend running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("Failed to start backend:", error.message);
    process.exit(1);
  }
}

startServer();
