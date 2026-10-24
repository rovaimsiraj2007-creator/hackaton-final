
import "./Sidebar.css";

const navigation = [
  { name: "Dashboard", icon: "▦" },
  { name: "Employees", icon: "♙" },
  { name: "Attendance", icon: "▣" },
  { name: "Monthly Reports", icon: "▤" },
  { name: "Settings", icon: "⚙" },
];

export default function Sidebar({
  activePage,
  setActivePage,
  user,
  onLogout,
}) {
  const avatarLetter = (user?.fullName || "U")
    .charAt(0)
    .toUpperCase();

  return (
    <aside className="hcm-sidebar">
      <div className="hcm-brand">
        <div className="hcm-brand-logo">H</div>
        <div>
          <h2>HCM Lite</h2>
          <span>Human Capital Management</span>
        </div>
      </div>

      <div className="hcm-menu-label">MAIN MENU</div>

      <nav className="hcm-navigation">
        {navigation.map((item) => (
          <button
            key={item.name}
            type="button"
            className={`hcm-nav-item ${
              activePage === item.name ? "active" : ""
            }`}
            onClick={() => setActivePage(item.name)}
          >
            <span className="hcm-nav-icon">{item.icon}</span>
            <span>{item.name}</span>
            {activePage === item.name && (
              <span className="hcm-active-indicator" />
            )}
          </button>
        ))}
      </nav>

      <div className="hcm-sidebar-bottom">
        <div className="hcm-sidebar-profile">
          <div className="hcm-avatar">{avatarLetter}</div>
          <div className="hcm-profile-info">
            <strong>{user?.fullName || "User"}</strong>
            <span>{user?.role || "Employee"}</span>
          </div>
        </div>

        <button
          type="button"
          className="hcm-logout-button"
          onClick={onLogout}
        >
          <span>↪</span> Sign Out
        </button>
      </div>
    </aside>
  );
}
