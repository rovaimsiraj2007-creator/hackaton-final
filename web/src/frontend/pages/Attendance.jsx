
import { useEffect, useMemo, useState } from "react";
import {
  getEmployees,
  getAttendance,
  saveAttendance,
} from "../services/api";
import "./Attendance.css";

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && String(value).includes("T")) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return String(value).slice(0, 5);
}

function minutesToHours(minutes) {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function toLocalDateTime(date, time) {
  if (!date || !time) return null;
  return `${date}T${time}:00+05:00`;
}

export default function Attendance({ user }) {
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    employeeId: "",
    attendanceDate: getToday(),
    checkIn: "",
    checkOut: "",
    status: "present",
    notes: "",
  });

  const canManage = ["admin", "hr"].includes(user?.role);
  const isAbsentOrLeave = ["absent", "leave"].includes(form.status);

  async function loadPage(date = selectedDate) {
    setLoading(true);
    setError("");

    try {
      const employeeResult = await getEmployees();
      setEmployees(employeeResult.employees || []);

      const attendanceResult = await getAttendance(date);
      setRecords(
        attendanceResult.attendance || attendanceResult.records || []
      );
    } catch (err) {
      setError(err.message || "Attendance data load nahi ho saka.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;

    return records.filter((record) => {
      const employee = employees.find(
        (item) => String(item.id) === String(record.employee_id)
      );

      const name =
        record.employee_name ||
        record.full_name ||
        employee?.full_name ||
        "";

      const code = record.employee_code || employee?.employee_code || "";

      return `${name} ${code} ${record.status || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [records, employees, search]);

  const summary = useMemo(() => {
    const getStatus = (record) =>
      String(record.status || "").toLowerCase();

    return {
      total: records.length,
      present: records.filter((record) =>
        ["present", "late", "half_day"].includes(getStatus(record))
      ).length,
      absent: records.filter(
        (record) => getStatus(record) === "absent"
      ).length,
      overtime: records.reduce(
        (total, record) =>
          total + Number(record.overtime_minutes || 0),
        0
      ),
    };
  }, [records]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.employeeId) {
      setError("Pehle employee select karein.");
      return;
    }

    if (!form.attendanceDate) {
      setError("Attendance date select karein.");
      return;
    }

    if (!isAbsentOrLeave && (!form.checkIn || !form.checkOut)) {
      setError("Check-in aur check-out time enter karein.");
      return;
    }

    if (
      !isAbsentOrLeave &&
      form.checkOut <= form.checkIn
    ) {
      setError(
        "Check-out time check-in se baad hona chahiye. Overnight shifts ke liye abhi next-day checkout supported nahi hai."
      );
      return;
    }

    setSaving(true);

    try {
      await saveAttendance({
        employeeId: Number(form.employeeId),

        // Backend expects "date", not "attendanceDate".
        date: form.attendanceDate,

        // Backend expects full date-time values.
        checkIn: isAbsentOrLeave
          ? null
          : toLocalDateTime(form.attendanceDate, form.checkIn),

        checkOut: isAbsentOrLeave
          ? null
          : toLocalDateTime(form.attendanceDate, form.checkOut),

        status: form.status,
        notes: form.notes.trim() || null,
      });

      setSuccess("Attendance successfully save ho gayi.");

      setSelectedDate(form.attendanceDate);

      setForm((previous) => ({
        ...previous,
        checkIn: "",
        checkOut: "",
        notes: "",
      }));

      await loadPage(form.attendanceDate);
    } catch (err) {
      setError(err.message || "Attendance save nahi ho saki.");
    } finally {
      setSaving(false);
    }
  }

  function getEmployeeName(record) {
    const employee = employees.find(
      (item) => String(item.id) === String(record.employee_id)
    );

    return (
      record.employee_name ||
      record.full_name ||
      employee?.full_name ||
      "Employee"
    );
  }

  function getStatusClass(status) {
    const value = String(status || "present")
      .toLowerCase()
      .replace("_", "-");

    return `attendance-status status-${value}`;
  }

  return (
    <div className="attendance-page">
      <section className="attendance-heading">
        <div>
          <span className="attendance-eyebrow">
            WORKFORCE MANAGEMENT
          </span>
          <h2>Attendance Management</h2>
          <p>
            Daily attendance, working hours aur overtime track karein.
          </p>
        </div>
      </section>

      {error && (
        <div className="attendance-alert attendance-alert-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="attendance-alert attendance-alert-success" role="status">
          {success}
        </div>
      )}

      <section className="attendance-summary">
        <article className="attendance-summary-card">
          <span>Total Records</span>
          <strong>{loading ? "—" : summary.total}</strong>
          <small>Selected date</small>
        </article>

        <article className="attendance-summary-card">
          <span>Present / Late / Half Day</span>
          <strong>{loading ? "—" : summary.present}</strong>
          <small>Attendance marked</small>
        </article>

        <article className="attendance-summary-card">
          <span>Absent</span>
          <strong>{loading ? "—" : summary.absent}</strong>
          <small>Marked absent</small>
        </article>

        <article className="attendance-summary-card">
          <span>Total Overtime</span>
          <strong>
            {loading ? "—" : minutesToHours(summary.overtime)}
          </strong>
          <small>Recorded overtime</small>
        </article>
      </section>

      {canManage && (
        <section className="attendance-panel">
          <div className="attendance-panel-heading">
            <div>
              <h3>Mark Attendance</h3>
              <p>Select an employee and enter attendance details.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="attendance-form-grid">
              <label>
                Employee *
                <select
                  name="employeeId"
                  value={form.employeeId}
                  onChange={updateForm}
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name || "Employee"}
                      {employee.employee_code
                        ? ` (${employee.employee_code})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Attendance Date *
                <input
                  name="attendanceDate"
                  type="date"
                  value={form.attendanceDate}
                  onChange={updateForm}
                  required
                />
              </label>

              <label>
                Check-in Time *
                <input
                  name="checkIn"
                  type="time"
                  value={form.checkIn}
                  onChange={updateForm}
                  disabled={isAbsentOrLeave}
                  required={!isAbsentOrLeave}
                />
              </label>

              <label>
                Check-out Time *
                <input
                  name="checkOut"
                  type="time"
                  value={form.checkOut}
                  onChange={updateForm}
                  disabled={isAbsentOrLeave}
                  required={!isAbsentOrLeave}
                />
              </label>

              <label>
                Attendance Status *
                <select
                  name="status"
                  value={form.status}
                  onChange={updateForm}
                  required
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="leave">Leave</option>
                </select>
              </label>

              <label>
                Notes
                <input
                  name="notes"
                  type="text"
                  value={form.notes}
                  onChange={updateForm}
                  placeholder="Optional notes"
                />
              </label>
            </div>

            <div className="attendance-form-actions">
              <button
                className="attendance-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Attendance"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="attendance-panel attendance-records-panel">
        <div className="attendance-records-heading">
          <div>
            <h3>Attendance Records</h3>
            <p>View records by date and search employees.</p>
          </div>

          <div className="attendance-filters">
            <input
              type="date"
              aria-label="Filter attendance by date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />

            <input
              type="search"
              aria-label="Search attendance records"
              placeholder="Search employee..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="attendance-empty">
            Loading attendance records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="attendance-empty">
            No attendance records found for this date.
          </div>
        ) : (
          <div className="attendance-table-scroll">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Working Hours</th>
                  <th>Overtime</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{getEmployeeName(record)}</strong>
                      <small>{record.employee_code || ""}</small>
                    </td>

                    <td>
                      {String(record.attendance_date || "").slice(0, 10)}
                    </td>

                    <td>{formatTime(record.check_in)}</td>
                    <td>{formatTime(record.check_out)}</td>

                    <td>
                      {minutesToHours(record.total_work_minutes)}
                    </td>

                    <td>
                      {minutesToHours(record.overtime_minutes)}
                    </td>

                    <td>
                      <span className={getStatusClass(record.status)}>
                        {String(record.status || "present").replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
