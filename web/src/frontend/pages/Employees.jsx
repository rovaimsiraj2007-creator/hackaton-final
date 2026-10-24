
import { useEffect, useMemo, useState } from "react";
import { createEmployee, getEmployees } from "../services/api";
import "./Employees.css";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  employeeCode: "",
  phone: "",
  department: "",
  designation: "",
  joiningDate: "",
  shiftType: "day",
  basicSalary: "",
  overtimeRate: "",
};

export default function Employees({ user }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  const canManage = ["admin", "hr"].includes(user?.role);

  async function loadEmployees() {
    setError("");

    try {
      const result = await getEmployees();
      setEmployees(result.employees || []);
    } catch (err) {
      setError(err.message || "Employees load nahi ho sake.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return employees;

    return employees.filter((employee) =>
      [
        employee.full_name,
        employee.fullName,
        employee.employee_code,
        employee.email,
        employee.department,
        employee.designation,
        employee.phone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [employees, search]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await createEmployee({
        ...form,
        basicSalary: Number(form.basicSalary || 0),
        overtimeRate: Number(form.overtimeRate || 0),
      });

      setForm(initialForm);
      setShowForm(false);
      setSuccess("Employee successfully add ho gaya.");
      await loadEmployees();
    } catch (err) {
      setError(err.message || "Employee add nahi ho saka.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = employees.filter(
    (employee) => employee.is_active === true
  ).length;

  return (
    <div className="employees-page">
      <section className="employees-heading">
        <div>
          <span className="employees-eyebrow">WORKFORCE MANAGEMENT</span>
          <h2>Employees</h2>
          <p>Employee records aur employment details manage karein.</p>
        </div>

        {canManage && (
          <button
            className="employees-primary-button"
            onClick={() => {
              setShowForm((previous) => !previous);
              setError("");
              setSuccess("");
            }}
            type="button"
          >
            {showForm ? "Cancel" : "+ Add Employee"}
          </button>
        )}
      </section>

      <section className="employees-stats">
        <article className="employees-stat-card">
          <span>Total Employees</span>
          <strong>{loading ? "—" : employees.length}</strong>
          <small>All employee records</small>
        </article>

        <article className="employees-stat-card">
          <span>Active Employees</span>
          <strong>{loading ? "—" : activeCount}</strong>
          <small>Currently active accounts</small>
        </article>

        <article className="employees-stat-card">
          <span>Search Results</span>
          <strong>{loading ? "—" : filteredEmployees.length}</strong>
          <small>Matching records</small>
        </article>
      </section>

      {error && (
        <div className="employees-alert employees-alert-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="employees-alert employees-alert-success" role="status">
          {success}
        </div>
      )}

      {showForm && canManage && (
        <section className="employees-form-panel">
          <div className="employees-panel-heading">
            <div>
              <h3>Add New Employee</h3>
              <p>Required information fill karein.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="employees-form-grid">
              <label>
                Full Name *
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={updateField}
                  placeholder="Employee full name"
                  required
                />
              </label>

              <label>
                Employee Code *
                <input
                  name="employeeCode"
                  value={form.employeeCode}
                  onChange={updateField}
                  placeholder="e.g. EMP-001"
                  required
                />
              </label>

              <label>
                Email Address *
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="employee@company.com"
                  required
                />
              </label>

              <label>
                Initial Password *
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={updateField}
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  required
                />
              </label>

              <label>
                Phone Number
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={updateField}
                  placeholder="03XXXXXXXXX"
                />
              </label>

              <label>
                Department
                <input
                  name="department"
                  value={form.department}
                  onChange={updateField}
                  placeholder="e.g. Human Resources"
                />
              </label>

              <label>
                Designation
                <input
                  name="designation"
                  value={form.designation}
                  onChange={updateField}
                  placeholder="e.g. HR Officer"
                />
              </label>

              <label>
                Joining Date
                <input
                  name="joiningDate"
                  type="date"
                  value={form.joiningDate}
                  onChange={updateField}
                />
              </label>

              <label>
                Shift *
                <select
                  name="shiftType"
                  value={form.shiftType}
                  onChange={updateField}
                  required
                >
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                </select>
              </label>

              <label>
                Basic Salary (PKR)
                <input
                  name="basicSalary"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.basicSalary}
                  onChange={updateField}
                  placeholder="e.g. 35000"
                />
              </label>

              <label>
                Overtime Rate (PKR/hour)
                <input
                  name="overtimeRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.overtimeRate}
                  onChange={updateField}
                  placeholder="e.g. 250"
                />
              </label>
            </div>

            <div className="employees-form-actions">
              <button
                className="employees-secondary-button"
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(initialForm);
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="employees-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Employee"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="employees-table-panel">
        <div className="employees-table-heading">
          <div>
            <h3>Employee Directory</h3>
            <p>Database mein saved employee records</p>
          </div>

          <input
            className="employees-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employees..."
            aria-label="Search employees"
          />
        </div>

        {loading ? (
          <div className="employees-empty">Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="employees-empty">
            {search
              ? "Search se matching employee nahi mila."
              : "Abhi koi employee record available nahi hai."}
          </div>
        ) : (
          <div className="employees-table-scroll">
            <table className="employees-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee Code</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Shift</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => {
                  const name =
                    employee.full_name ||
                    employee.fullName ||
                    employee.name ||
                    "Unnamed Employee";

                  return (
                    <tr key={employee.id || employee.employee_code}>
                      <td>
                        <div className="employees-person">
                          <span className="employees-person-avatar">
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <strong>{name}</strong>
                            <small>{employee.email || "—"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{employee.employee_code || "—"}</td>
                      <td>{employee.department || "—"}</td>
                      <td>{employee.designation || "—"}</td>
                      <td>
                        <span className="employees-shift-badge">
                          {(employee.shift_type || employee.shiftType || "day")
                            .toLowerCase() === "night"
                            ? "Night"
                            : "Day"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`employees-status ${
                            employee.is_active === false
                              ? "inactive"
                              : "active"
                          }`}
                        >
                          {employee.is_active === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
