import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

function Welcome() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>; 
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === "ADMIN") {
    return <Navigate to="/admin" replace />;
  }

  if (role === "ENGINEER") {
    return <Navigate to="/engineer" replace />;
  }

  if (user && !role) {
  toast.error("Your account is not properly configured");
  return <Navigate to="/login" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default Welcome;
