
import { useEffect, useState } from "react";
import "./Settings.css";

const API_BASE = "http://localhost:5000/api";

const WEEKDAYS = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
  { label: "Sunday", value: 0 },
];

const DEFAULT_SETTINGS = {
  company_name: "",
  office_start_time: "09:00",
  grace_minutes: 15,
  standard_work_hours: 8,
  lunch_break_minutes: 60,
  weekend_days: [0],
};

export default function Settings({ user }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const token = localStorage.getItem("hcm_token");

        const response = await fetch(`${API_BASE}/settings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Settings API is not available yet. Backend connection is required."
          );
        }

        const saved = data.settings || data;

        if (active) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...saved,
            weekend_days: Array.isArray(saved.weekend_days)
              ? saved.weekend_days.map(Number)
              : DEFAULT_SETTINGS.weekend_days,
            grace_minutes: Number(saved.grace_minutes ?? 15),
            standard_work_hours: Number(
              saved.standard_work_hours ?? 8
            ),
            lunch_break_minutes: Number(
              saved.lunch_break_minutes ?? 60
            ),
          });
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err.message ||
              "Could not load settings. Check the backend connection."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  function updateField(name, value) {
    setSettings((previous) => ({
      ...previous,
      [name]: value,
    }));
    setMessage("");
  }

  function toggleWeekend(day) {
    setSettings((previous) => {
      const current = previous.weekend_days || [];
      const updated = current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day];

      return { ...previous, weekend_days: updated };
    });
    setMessage("");
  }

  async function handleSave(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!isAdmin) {
      setError("Only an authorized administrator can change settings.");
      return;
    }

    if (!settings.company_name.trim()) {
      setError("Please enter the company name.");
      return;
    }

    if (
      !Number.isFinite(Number(settings.standard_work_hours)) ||
      Number(settings.standard_work_hours) <= 0 ||
      Number(settings.standard_work_hours) > 24
    ) {
      setError("Working hours must be between 1 and 24.");
      return;
    }

    if (
      Number(settings.lunch_break_minutes) < 0 ||
      Number(settings.grace_minutes) < 0
    ) {
      setError("Break and grace minutes cannot be negative.");
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("hcm_token");

      const response = await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...settings,
          standard_work_hours: Number(settings.standard_work_hours),
          lunch_break_minutes: Number(settings.lunch_break_minutes),
          grace_minutes: Number(settings.grace_minutes),
          weekend_days: settings.weekend_days,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not save settings. Make sure the backend PUT /api/settings route exists."
        );
      }

      const saved = data.settings || data;

      setSettings((previous) => ({
        ...previous,
        ...saved,
        weekend_days: Array.isArray(saved.weekend_days)
          ? saved.weekend_days.map(Number)
          : previous.weekend_days,
      }));

      setMessage(data.message || "Settings saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">Loading company settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <span className="settings-eyebrow">HCM LITE / CONFIGURATION</span>
          <h2>Company Settings</h2>
          <p>
            Manage office timings, working hours, breaks and weekly holidays.
          </p>
        </div>
        <div className="settings-header-icon">⚙</div>
      </div>

      {!isAdmin && (
        <div className="settings-alert warning">
          You have read-only access. Only an administrator can change settings.
        </div>
      )}

      {error && (
        <div className="settings-alert error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="settings-alert success" role="status">
          {message}
        </div>
      )}

      <form onSubmit={handleSave}>
        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-icon">▤</div>
            <div>
              <h3>Company Information</h3>
              <p>Basic details for your organization</p>
            </div>
          </div>

          <div className="settings-fields">
            <label className="settings-field full-width">
              <span>Company Name</span>
              <input
                type="text"
                value={settings.company_name || ""}
                onChange={(e) =>
                  updateField("company_name", e.target.value)
                }
                placeholder="Enter company name"
                disabled={!isAdmin}
                required
              />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-icon">◷</div>
            <div>
              <h3>Office & Working Hours</h3>
              <p>Configure daily attendance and work duration</p>
            </div>
          </div>

          <div className="settings-fields">
            <label className="settings-field">
              <span>Office Start Time</span>
              <input
                type="time"
                value={String(settings.office_start_time || "09:00").slice(0, 5)}
                onChange={(e) =>
                  updateField("office_start_time", e.target.value)
                }
                disabled={!isAdmin}
                required
              />
              <small>Official start time for the workday</small>
            </label>

            <label className="settings-field">
              <span>Standard Daily Work Hours</span>
              <select
                value={settings.standard_work_hours}
                onChange={(e) =>
                  updateField("standard_work_hours", Number(e.target.value))
                }
                disabled={!isAdmin}
              >
                <option value={8}>8 hours</option>
                <option value={9}>9 hours</option>
                <option value={10}>10 hours</option>
                <option value={12}>12 hours</option>
              </select>
              <small>Used to calculate overtime</small>
            </label>

            <label className="settings-field">
              <span>Lunch / Break Duration (minutes)</span>
              <input
                type="number"
                min="0"
                max="300"
                value={settings.lunch_break_minutes}
                onChange={(e) =>
                  updateField("lunch_break_minutes", e.target.value)
                }
                disabled={!isAdmin}
              />
              <small>Deducted from elapsed time when calculating work</small>
            </label>

            <label className="settings-field">
              <span>Late Arrival Grace (minutes)</span>
              <input
                type="number"
                min="0"
                max="180"
                value={settings.grace_minutes}
                onChange={(e) =>
                  updateField("grace_minutes", e.target.value)
                }
                disabled={!isAdmin}
              />
              <small>Allowed delay after office start time</small>
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-icon">▦</div>
            <div>
              <h3>Weekly Holidays</h3>
              <p>Select the days when the office is normally closed</p>
            </div>
          </div>

          <div className="settings-weekdays">
            {WEEKDAYS.map((day) => {
              const selected = (settings.weekend_days || []).includes(
                day.value
              );

              return (
                <label
                  key={day.value}
                  className={`settings-day ${selected ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleWeekend(day.value)}
                    disabled={!isAdmin}
                  />
                  <span className="settings-day-check">
                    {selected ? "✓" : ""}
                  </span>
                  <span>{day.label}</span>
                </label>
              );
            })}
          </div>
        </section>

        {isAdmin && (
          <div className="settings-save-bar">
            <p>Changes apply after they are successfully saved.</p>
            <button
              type="submit"
              className="settings-save-button"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
