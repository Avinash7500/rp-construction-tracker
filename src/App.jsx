import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Engineer from "./pages/Engineer";
import Welcome from "./pages/Welcome";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <Admin />
          </ProtectedRoute>
        }
      />

      <Route
        path="/engineer"
        element={
          <ProtectedRoute role="ENGINEER">
            <Engineer />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
