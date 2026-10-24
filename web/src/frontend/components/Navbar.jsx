
import "./Navbar.css";

export default function Navbar({ activePage, user }) {
  const avatarLetter = (user?.fullName || "U")
    .charAt(0)
    .toUpperCase();

  const today = new Date().toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <header className="hcm-topbar">
      <div>
        <div className="hcm-breadcrumb">
          Workspace / {activePage}
        </div>
        <h1>{activePage}</h1>
      </div>

      <div className="hcm-topbar-right">
        <div className="hcm-date">{today}</div>
        <div
          className="hcm-top-avatar"
          title={user?.fullName || "User"}
        >
          {avatarLetter}
        </div>
      </div>
    </header>
  );
}
