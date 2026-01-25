import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout } from "../utils/logout";

export default function ProtectedRoute({ children, role }) {
  const { user, userDoc, role: userRole } = useAuth();

  // ✅ 1) Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ✅ 2) Firestore profile missing (rare but possible)
  if (!userDoc) {
    // logout to clear session
    logout().catch(() => {});
    return <Navigate to="/login" replace />;
  }

  // ✅ 3) Access disabled
  if (userDoc?.isActive === false) {
    logout().catch(() => {});
    return <Navigate to="/login" replace />;
  }

  // ✅ 4) Role not loaded / missing
  if (!userRole) {
    return <Navigate to="/login" replace />;
  }

  // ✅ 5) Role mismatch -> redirect to correct page
  if (role && userRole !== role) {
    if (userRole === "ADMIN") return <Navigate to="/admin" replace />;
    return <Navigate to="/engineer" replace />;
  }

  return children;
}
