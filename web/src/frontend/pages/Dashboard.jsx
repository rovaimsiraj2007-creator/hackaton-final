import { useEffect, useState } from "react";
import { getEmployees } from "../services/api";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Employees from "./Employees";
import Attendance from "./Attendance";
import MonthlyReports from "./MonthlyReports";
import Settings from "./Settings";
import "./Dashboard.css";

export default function Dashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadEmployees() {
      try {
        const result = await getEmployees();

        if (mounted) {
          setEmployees(result.employees || []);
          setEmployeeError("");
        }
      } catch (error) {
        if (mounted) {
          setEmployeeError(
            error.message || "Unable to load employee records."
          );
        }
      }
    }

    loadEmployees();

    return () => {
      mounted = false;
    };
  }, []);

  const activeEmployees = employees.filter(
    (employee) => employee.is_active === true
  ).length;

  function renderPage() {
    switch (activePage) {
      case "Employees":
        return <Employees user={user} />;

      case "Attendance":
        return <Attendance user={user} />;

      case "Monthly Reports":
        return <MonthlyReports user={user} />;

      case "Settings":
        return <Settings user={user} />;

      default:
        return (
          <div className="hcm-content">
            <section className="hcm-welcome">
              <div>
                <span className="hcm-welcome-tag">OVERVIEW</span>
                <h2>
                  Welcome back, {user?.fullName || "User"}!
                </h2>
                <p>
                  Manage employees, attendance, monthly reports and
                  company settings from one workspace.
                </p>
              </div>
              <div className="hcm-welcome-decoration">HCM</div>
            </section>

            <section className="hcm-stat-grid">
              <article className="hcm-stat-card">
                <div className="hcm-stat-top">
                  <span className="hcm-stat-icon navy">♙</span>
                  <span className="hcm-stat-label">WORKFORCE</span>
                </div>
                <div className="hcm-stat-value">
                  {employeeError ? "—" : employees.length}
                </div>
                <div className="hcm-stat-description">
                  Total Employees
                </div>
                <div className="hcm-stat-footer">
                  Registered employee profiles
                </div>
              </article>

              <article className="hcm-stat-card">
                <div className="hcm-stat-top">
                  <span className="hcm-stat-icon green">✓</span>
                  <span className="hcm-stat-label">EMPLOYMENT</span>
                </div>
                <div className="hcm-stat-value">
                  {employeeError ? "—" : activeEmployees}
                </div>
                <div className="hcm-stat-description">
                  Active Employees
                </div>
                <div className="hcm-stat-footer">
                  Employees currently marked active
                </div>
              </article>

              <article className="hcm-stat-card">
                <div className="hcm-stat-top">
                  <span className="hcm-stat-icon gold">◷</span>
                  <span className="hcm-stat-label">ATTENDANCE</span>
                </div>
                <div className="hcm-stat-value">—</div>
                <div className="hcm-stat-description">
                  Present Today
                </div>
                <div className="hcm-stat-footer">
                  Daily summary not connected
                </div>
              </article>

              <article className="hcm-stat-card">
                <div className="hcm-stat-top">
                  <span className="hcm-stat-icon red">!</span>
                  <span className="hcm-stat-label">ATTENDANCE</span>
                </div>
                <div className="hcm-stat-value">—</div>
                <div className="hcm-stat-description">
                  Absent Today
                </div>
                <div className="hcm-stat-footer">
                  Daily summary not connected
                </div>
              </article>
            </section>

            {employeeError && (
              <div className="hcm-alert" role="alert">
                {employeeError}
              </div>
            )}

            <section className="hcm-bottom-grid">
              <article className="hcm-panel">
                <div className="hcm-panel-heading">
                  <div>
                    <h3>Quick Actions</h3>
                    <p>Open a management section</p>
                  </div>
                </div>

                <div className="hcm-quick-actions">
                  {[
                    {
                      name: "Employees",
                      icon: "♙",
                      description: "Manage employee records",
                    },
                    {
                      name: "Attendance",
                      icon: "▣",
                      description: "Record daily attendance",
                    },
                    {
                      name: "Monthly Reports",
                      icon: "▤",
                      description: "Review hours and overtime",
                    },
                    ...(user?.role === "admin"
                      ? [
                          {
                            name: "Settings",
                            icon: "⚙",
                            description: "Configure work settings",
                          },
                        ]
                      : []),
                  ].map((action) => (
                    <button
                      key={action.name}
                      type="button"
                      className="hcm-action-card"
                      onClick={() => setActivePage(action.name)}
                    >
                      <span className="hcm-action-icon navy">
                        {action.icon}
                      </span>
                      <span>
                        <strong>{action.name}</strong>
                        <small>{action.description}</small>
                      </span>
                      <b>→</b>
                    </button>
                  ))}
                </div>
              </article>

              <article className="hcm-panel hcm-account-panel">
                <div className="hcm-panel-heading">
                  <div>
                    <h3>Account Information</h3>
                    <p>Your signed-in account</p>
                  </div>
                </div>

                <div className="hcm-account-avatar">
                  {(user?.fullName || "U").charAt(0).toUpperCase()}
                </div>

                <h4>{user?.fullName || "User"}</h4>
                <p className="hcm-account-email">
                  {user?.email || "—"}
                </p>

                <span className="hcm-role-badge">
                  {user?.role || "employee"}
                </span>

                <div className="hcm-account-details">
                  <div>
                    <span>Account ID</span>
                    <strong>{user?.id || "—"}</strong>
                  </div>
                  <div>
                    <span>Access Role</span>
                    <strong>
                      {(user?.role || "employee").toUpperCase()}
                    </strong>
                  </div>
                </div>
              </article>
            </section>

            <footer className="hcm-footer">
              <span>HCM Lite</span>
              <span>Human Capital Management System</span>
            </footer>
          </div>
        );
    }
  }

  return (
    <div className="hcm-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        user={user}
        onLogout={onLogout}
      />

      <main className="hcm-main">
        <Navbar activePage={activePage} user={user} />
        {renderPage()}
      </main>
    </div>
  );
}
