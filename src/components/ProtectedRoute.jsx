import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppSplash from "./AppSplash";

export default function ProtectedRoute({ children, role, allowedRoles }) {
  const { user, userDoc, role: userRole, loading } = useAuth();

  if (loading) {
    return <AppSplash />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!userDoc) {
    return <Navigate to="/login" replace />;
  }

  if (userDoc?.isActive === false) {
    return <Navigate to="/login" replace />;
  }

  if (!userRole) {
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      if (userRole === "ADMIN") return <Navigate to="/admin" replace />;
      if (userRole === "ACCOUNTANT") {
        return <Navigate to="/accountant/dashboard" replace />;
      }
      return <Navigate to="/engineer" replace />;
    }
    return children;
  }

  if (role && userRole !== role) {
    if (userRole === "ADMIN") return <Navigate to="/admin" replace />;
    if (userRole === "ACCOUNTANT") {
      return <Navigate to="/accountant/dashboard" replace />;
    }
    return <Navigate to="/engineer" replace />;
  }

  return children;
}

