import { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import "./AccountantShell.css";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/accountant/dashboard" },
  { label: "Attendance", to: "/accountant/attendance" },
  { label: "Dealers Ledger", to: "/accountant/dealers" },
  { label: "Reports (अहवाल)", to: "/accountant/reports" },
];

export default function AccountantShell({ title, subtitle, actions, children }) {
  const navigate = useNavigate();
  const { userDoc } = useAuth();

  const displayName = useMemo(() => {
    return userDoc?.name || "Accountant";
  }, [userDoc]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showSuccess("Logged out successfully");
      navigate("/login");
    } catch (e) {
      showError(e, "Logout failed");
    }
  };

  return (
    <div className="acc-shell">
      <aside className="acc-sidebar">
        <div className="acc-logo">R.P. CONSTRUCTION</div>
        <div className="acc-user">{displayName}</div>
        <nav className="acc-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              className={({ isActive }) => `acc-nav-item${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="acc-logout" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="acc-main">
        <header className="acc-header">
          <div>
            <h1 className="acc-title">{title}</h1>
            {subtitle ? <p className="acc-subtitle">{subtitle}</p> : null}
          </div>
          <div className="acc-header-actions">{actions}</div>
        </header>
        <section className="acc-content">{children}</section>
      </main>
    </div>
  );
}
