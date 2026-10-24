
import { useEffect, useState } from "react";
import Login from "./frontend/pages/Login";
import Dashboard from "./frontend/pages/Dashboard";
import {
  clearSession,
  getCurrentUser,
  getSavedUser,
} from "./frontend/services/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (!getSavedUser()) {
        if (active) setCheckingSession(false);
        return;
      }

      try {
        const result = await getCurrentUser();

        if (active) {
          setUser(result.user);
        }
      } catch {
        clearSession();

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  function handleLogin(loggedInUser) {
    setUser(loggedInUser);
  }

  function handleLogout() {
    clearSession();
    setUser(null);
  }

  if (checkingSession) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Loading HCM Lite...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
  