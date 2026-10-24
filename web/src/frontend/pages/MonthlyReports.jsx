
import { useEffect, useMemo, useState } from "react";
import { getEmployees, getAttendance } from "../services/api";
import * as XLSX from "xlsx";
import "./MonthlyReports.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (value) => String(value).padStart(2, "0");

function formatHours(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  return `${Math.floor(value / 60)}h ${value % 60}m`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = String(value).slice(0, 10);
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function statusLabel(value) {
  const labels = {
    present: "Present",
    absent: "Absent",
    late: "Late",
    half_day: "Half Day",
    leave: "Leave",
  };
  return labels[value] || value || "—";
}

export default function MonthlyReports({ user }) {
  const now = new Date();

  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReportData() {
      setLoading(true);
      setError("");

      try {
        const [employeeResult, attendanceResult] = await Promise.all([
          getEmployees(),
          getAttendance(),
        ]);

        if (!active) return;

        setEmployees(employeeResult.employees || []);
        setAttendance(attendanceResult.attendance || []);
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load monthly report data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReportData();

    return () => {
      active = false;
    };
  }, []);

  const monthPrefix = `${year}-${pad(Number(month) + 1)}`;

  const monthlyAttendance = useMemo(
    () =>
      attendance.filter(
        (record) =>
          String(record.attendance_date || "").slice(0, 7) === monthPrefix
      ),
    [attendance, monthPrefix]
  );

  const filteredEmployees = useMemo(
    () =>
      employeeFilter === "all"
        ? employees
        : employees.filter(
            (employee) => String(employee.id) === employeeFilter
          ),
    [employees, employeeFilter]
  );

  const filteredAttendance = useMemo(
    () =>
      employeeFilter === "all"
        ? monthlyAttendance
        : monthlyAttendance.filter(
            (record) => String(record.employee_id) === employeeFilter
          ),
    [monthlyAttendance, employeeFilter]
  );

  const summary = useMemo(
    () =>
      filteredEmployees.map((employee) => {
        const records = filteredAttendance.filter(
          (record) => String(record.employee_id) === String(employee.id)
        );

        const totalMinutes = records.reduce(
          (sum, record) => sum + (Number(record.total_work_minutes) || 0),
          0
        );

        const overtimeMinutes = records.reduce(
          (sum, record) => sum + (Number(record.overtime_minutes) || 0),
          0
        );

        return {
          id: employee.id,
          code: employee.employee_code || "—",
          name: employee.full_name || employee.fullName || "Unnamed",
          department: employee.department || "—",
          present: records.filter((r) => r.status === "present").length,
          late: records.filter((r) => r.status === "late").length,
          absent: records.filter((r) => r.status === "absent").length,
          halfDay: records.filter((r) => r.status === "half_day").length,
          leave: records.filter((r) => r.status === "leave").length,
          totalMinutes,
          overtimeMinutes,
          records,
        };
      }),
    [filteredEmployees, filteredAttendance]
  );

  const totals = useMemo(
    () =>
      summary.reduce(
        (result, employee) => ({
          present: result.present + employee.present,
          late: result.late + employee.late,
          absent: result.absent + employee.absent,
          leave: result.leave + employee.leave,
          totalMinutes: result.totalMinutes + employee.totalMinutes,
          overtimeMinutes:
            result.overtimeMinutes + employee.overtimeMinutes,
        }),
        {
          present: 0,
          late: 0,
          absent: 0,
          leave: 0,
          totalMinutes: 0,
          overtimeMinutes: 0,
        }
      ),
    [summary]
  );

  function exportExcel() {
    const summaryRows = summary.map((employee) => ({
      "Employee Code": employee.code,
      "Employee Name": employee.name,
      Department: employee.department,
      Present: employee.present,
      Late: employee.late,
      Absent: employee.absent,
      "Half Day": employee.halfDay,
      Leave: employee.leave,
      "Total Working Hours": formatHours(employee.totalMinutes),
      "Overtime Hours": formatHours(employee.overtimeMinutes),
    }));

    const dailyRows = filteredAttendance.map((record) => {
      const employee = employees.find(
        (item) => String(item.id) === String(record.employee_id)
      );

      return {
        Date: formatDate(record.attendance_date),
        "Employee Code": record.employee_code || employee?.employee_code || "—",
        "Employee Name":
          record.employee_name ||
          employee?.full_name ||
          employee?.fullName ||
          "—",
        Department: record.department || employee?.department || "—",
        Status: statusLabel(record.status),
        "Check In": formatTime(record.check_in),
        "Check Out": formatTime(record.check_out),
        "Working Hours": formatHours(record.total_work_minutes),
        "Overtime Hours": formatHours(record.overtime_minutes),
        Notes: record.notes || "",
      };
    });

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      "Monthly Summary"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(dailyRows),
      "Daily Details"
    );

    XLSX.writeFile(
      workbook,
      `HCM-Lite-Report-${year}-${pad(Number(month) + 1)}.xlsx`
    );
  }

  return (
    <div className="monthly-report">
      <div className="report-toolbar no-print">
        <div>
          <span className="report-eyebrow">HCM LITE / REPORTING</span>
          <h2>Monthly Attendance Reports</h2>
          <p>Review employee attendance, working hours and overtime.</p>
        </div>

        <div className="report-actions">
          <button
            type="button"
            className="report-button secondary"
            onClick={() => window.print()}
            disabled={loading || !!error}
          >
            Print Report
          </button>

          <button
            type="button"
            className="report-button primary"
            onClick={exportExcel}
            disabled={loading || !!error}
          >
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="report-filters no-print">
        <label>
          Month
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((name, index) => (
              <option key={name} value={String(index)}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Year
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {Array.from(
              { length: 7 },
              (_, index) => now.getFullYear() - 5 + index
            ).map((value) => (
              <option key={value} value={String(value)}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          Employee
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          >
            <option value="all">All Employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={String(employee.id)}>
                {employee.employee_code || employee.id} —{" "}
                {employee.full_name || employee.fullName || "Employee"}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="report-button secondary"
          onClick={() => {
            setMonth(String(now.getMonth()));
            setYear(String(now.getFullYear()));
            setEmployeeFilter("all");
          }}
        >
          Reset Filters
        </button>
      </div>

      {error && (
        <div className="report-message error" role="alert">
          {error}
          <button
            type="button"
            className="report-button secondary no-print"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )}

      {loading ? (
        <div className="report-message">Loading attendance report…</div>
      ) : !error ? (
        <div className="report-print-area">
          <div className="print-heading">
            <h1>HCM Lite</h1>
            <h2>Monthly Attendance Report</h2>
            <p>
              Period: {MONTHS[Number(month)]} {year}
            </p>
            <p>Generated: {new Date().toLocaleDateString("en-PK")}</p>
          </div>

          <section className="report-stat-grid">
            <article className="report-stat-card">
              <span>Employees</span>
              <strong>{filteredEmployees.length}</strong>
            </article>
            <article className="report-stat-card">
              <span>Present Records</span>
              <strong>{totals.present}</strong>
            </article>
            <article className="report-stat-card">
              <span>Total Working Hours</span>
              <strong>{formatHours(totals.totalMinutes)}</strong>
            </article>
            <article className="report-stat-card">
              <span>Total Overtime</span>
              <strong>{formatHours(totals.overtimeMinutes)}</strong>
            </article>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <div>
                <h3>Employee Monthly Summary</h3>
                <p>Attendance counts and accumulated working time</p>
              </div>
              <span>{summary.length} employees</span>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Present</th>
                    <th>Late</th>
                    <th>Absent</th>
                    <th>Half Day</th>
                    <th>Leave</th>
                    <th>Working Hours</th>
                    <th>Overtime</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <strong>{employee.name}</strong>
                        <small>{employee.code}</small>
                      </td>
                      <td>{employee.department}</td>
                      <td>{employee.present}</td>
                      <td>{employee.late}</td>
                      <td>{employee.absent}</td>
                      <td>{employee.halfDay}</td>
                      <td>{employee.leave}</td>
                      <td>{formatHours(employee.totalMinutes)}</td>
                      <td>{formatHours(employee.overtimeMinutes)}</td>
                    </tr>
                  ))}

                  {summary.length === 0 && (
                    <tr>
                      <td colSpan="9" className="report-empty">
                        No employees found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <div>
                <h3>Daily Attendance Breakdown</h3>
                <p>Individual attendance entries for the selected month</p>
              </div>
              <span>{filteredAttendance.length} records</span>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Working Hours</th>
                    <th>Overtime</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredAttendance]
                    .sort((a, b) =>
                      String(a.attendance_date).localeCompare(
                        String(b.attendance_date)
                      )
                    )
                    .map((record) => (
                      <tr key={record.id}>
                        <td>{formatDate(record.attendance_date)}</td>
                        <td>
                          <strong>
                            {record.employee_name ||
                              employees.find(
                                (e) =>
                                  String(e.id) ===
                                  String(record.employee_id)
                              )?.full_name ||
                              employees.find(
                                (e) =>
                                  String(e.id) ===
                                  String(record.employee_id)
                              )?.fullName ||
                              "Employee"}
                          </strong>
                          <small>{record.employee_code || "—"}</small>
                        </td>
                        <td>{record.department || "—"}</td>
                        <td>
                          <span
                            className={`report-status ${record.status || ""}`}
                          >
                            {statusLabel(record.status)}
                          </span>
                        </td>
                        <td>{formatTime(record.check_in)}</td>
                        <td>{formatTime(record.check_out)}</td>
                        <td>{formatHours(record.total_work_minutes)}</td>
                        <td>{formatHours(record.overtime_minutes)}</td>
                        <td>{record.notes || "—"}</td>
                      </tr>
                    ))}

                  {filteredAttendance.length === 0 && (
                    <tr>
                      <td colSpan="9" className="report-empty">
                        No attendance records for this month and filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="report-footer">
            HCM Lite · Human Capital Management System
          </footer>
        </div>
      ) : null}
    </div>
  );
}
